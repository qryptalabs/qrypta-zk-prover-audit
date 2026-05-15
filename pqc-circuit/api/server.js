const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const RUTA_PROYECTO_RUST = "/root/qrypta-sp1/genesis-prover";
const RUTA_ELF = "/root/qrypta-sp1/program/target/elf-compilation/riscv32im-succinct-zkvm-elf/release/program";

// Max proof time: 50 minutes (ML-DSA-44 circuit is more complex than placeholder — ~26min average)
const PROOF_TIMEOUT_MS = 50 * 60 * 1000;

let jobs = {};
let isProving = false;
let provingTimer = null;

function resetProving() {
    isProving = false;
    if (provingTimer) { clearTimeout(provingTimer); provingTimer = null; }
}

app.post('/prove', async (req, res) => {
    console.log("\n--- 📥 PETICIÓN RECIBIDA ---");
    if (isProving) {
        return res.status(503).json({ error: "busy", message: "Prover ocupado, intenta en un minuto." });
    }

    const jobIdStr = Date.now().toString();
    isProving = true;

    // Safety timeout — reset isProving after 50 min regardless of Rust status
    // ML-DSA-44 circuit takes ~26min (vs ~20min for placeholder)
    provingTimer = setTimeout(() => {
        console.warn("⚠️ Proof timeout (50min). Resetting isProving flag.");
        resetProving();
        if (jobs[jobIdStr] && jobs[jobIdStr].status === 'processing') {
            jobs[jobIdStr] = { status: "failed", error: "Timeout after 50 minutes" };
        }
    }, PROOF_TIMEOUT_MS);

    let publicValuesHex = req.body.publicValuesHex || (req.body.data && req.body.data.publicValuesHex);

    // Auto-detect chainId from token address (source of truth) 
    // This avoids relying on the frontend to pass the correct 'chain' param
    const CORE_TOKEN = '0x5266fe1ad9b035d0ed6142f1a70e9d6f102c8153';
    const tokenLower = (req.body.token || '').toLowerCase();

    let chainIdValue = 56; // default BNB
    // Priority: explicit chain param first (what MetaMask has selected), then token address as fallback for Core
    if      (req.body.chain === 'bnb')  chainIdValue = 56;
    else if (req.body.chain === 'eth')  chainIdValue = 1;
    else if (req.body.chain === 'core') chainIdValue = 1116;
    else if (tokenLower === CORE_TOKEN) chainIdValue = 1116; // fallback: detect Core by token address
    // else: stays 56 (BNB default)
    
    console.log(`🔗 chain param: "${req.body.chain}" | token: ${tokenLower}`);
    console.log(`🔗 chainId resolved: ${chainIdValue}`);

    if (!publicValuesHex && req.body.sender) {
        try {
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const isoRef = req.body.isoReference || "";
            const isoRefHash = ethers.keccak256(ethers.toUtf8Bytes(isoRef));
            const pqcRoot = req.body.pqcRoot || "0x0000000000000000000000000000000000000000000000000000000000000000";

            publicValuesHex = abiCoder.encode(
                ["address", "address", "uint256", "uint256", "bytes32", "bytes32", "uint256", "address", "uint256"],
                [
                    req.body.sender,
                    req.body.recipient,
                    ethers.parseUnits((req.body.amount || "0").toString(), req.body.decimals || 18),
                    BigInt(req.body.nonce || 0),
                    pqcRoot,
                    isoRefHash,
                    BigInt(chainIdValue),
                    req.body.token,
                    BigInt(req.body.deadline || Math.floor(Date.now() / 1000) + 31536000)
                ]
            );
            
            // Verify 288 bytes
            const pvLen = (publicValuesHex.length - 2) / 2;
            console.log(`📦 publicValues encoded: ${pvLen} bytes (expected 288)`);
            if (pvLen !== 288) {
                resetProving();
                return res.status(400).json({ error: `publicValues tiene ${pvLen} bytes, se esperaban 288` });
            }
        } catch (e) {
            resetProving();
            return res.status(400).json({ error: "Fallo en la traducción", detalle: e.message });
        }
    }

    if (!publicValuesHex) {
        resetProving();
        return res.status(400).json({ error: "No se pudo construir publicValues: faltan parámetros" });
    }

    jobs[jobIdStr] = { status: "processing" };
    res.status(200).json({ success: true, jobId: jobIdStr, status: "processing" });

    // Write public values input file for Rust prover
    const inputFile = path.join(RUTA_PROYECTO_RUST, `publicValues_${chainIdValue}.hex`);
    fs.writeFileSync(inputFile, publicValuesHex);

    // Write private witnesses for ML-DSA-44 in-circuit verification (Phase 3 — QRA-11 fix)
    // These are the private inputs to the ZK circuit — never go on-chain
    const msgFile = path.join(RUTA_PROYECTO_RUST, `message_${chainIdValue}.hex`);
    const pkFile  = path.join(RUTA_PROYECTO_RUST, `pubkey_${chainIdValue}.hex`);
    const sigFile = path.join(RUTA_PROYECTO_RUST, `sig_${chainIdValue}.hex`);
    const messageHex   = req.body.messageHex  || '';
    const publicKeyHex = req.body.publicKey   || '';
    const signatureHex = req.body.signature   || '';
    if (!messageHex || !publicKeyHex || !signatureHex) {
        resetProving();
        return res.status(400).json({ 
            error: "Missing PQC witness data", 
            detail: "messageHex, publicKey, and signature are required for ML-DSA-44 in-circuit verification"
        });
    }
    fs.writeFileSync(msgFile, messageHex);
    fs.writeFileSync(pkFile,  publicKeyHex);
    fs.writeFileSync(sigFile, signatureHex);
    console.log(`🔐 ML-DSA-44 witnesses written: msg=${messageHex.length/2-1}B pk=${publicKeyHex.length/2-1}B sig=${signatureHex.length/2-1}B`);

    // Remove old proof files
    const proofFile = path.join(RUTA_PROYECTO_RUST, `proof_${chainIdValue}.hex`);
    const pvFromProofFile = path.join(RUTA_PROYECTO_RUST, `publicValues_from_proof_${chainIdValue}.hex`);
    try { fs.unlinkSync(proofFile); fs.unlinkSync(pvFromProofFile); } catch(e) {}

    const comando = `RUST_LOG=info ELF=${RUTA_ELF} GENESIS_DIR=. CHAIN_ID=${chainIdValue} cargo run --release --bin qrypta-genesis-prover`;
    console.log(`🦀 Ejecutando Rust prover con chainId=${chainIdValue}...`);

    exec(comando, { cwd: RUTA_PROYECTO_RUST, maxBuffer: 1024 * 1024 * 500 }, (error, stdout, stderr) => {
        resetProving();
        if (!error && fs.existsSync(proofFile)) {
            const proofData = fs.readFileSync(proofFile, 'utf8').trim();

            // Use the INPUT publicValues (288 bytes flat ABI encoded).
            // The Rust circuit does io::commit_slice(&public_values) of exactly these bytes.
            const canonicalPV = publicValuesHex.startsWith('0x') ? publicValuesHex : '0x' + publicValuesHex;
            const pvLen = (canonicalPV.length - 2) / 2;
            console.log(`✅ Proof completado! publicValues: ${pvLen} bytes | chainId: ${chainIdValue}`);

            jobs[jobIdStr] = { 
                status: "completed", 
                proof: proofData.startsWith('0x') ? proofData : '0x' + proofData,
                publicValues: canonicalPV
            };
        } else {
            console.error("❌ Fallo en Rust:", error?.message);
            jobs[jobIdStr] = { status: "failed", error: "Error en Rust" };
        }
    });
});

// Reset endpoint — allows manually unlocking the prover without restart
app.post('/reset', (req, res) => {
    const wasProving = isProving;
    resetProving();
    console.log(`🔄 Manual reset. wasProving=${wasProving}`);
    res.json({ ok: true, wasProving });
});

app.get('/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ error: "No encontrado" });
    res.status(200).json(job);
});

app.get('/health', (req, res) => {
    res.json({ ok: true, isProving, jobs: Object.keys(jobs).length });
});

app.listen(3001, () => console.log("🟢 Qrypta ZK Prover v2 — chainId auto-detect from token address"));
