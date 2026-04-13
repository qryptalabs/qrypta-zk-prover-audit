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
const CHAIN_ID = "56";

let jobs = {};
let isProving = false;

app.post('/prove', async (req, res) => {
    console.log("\n--- 📥 PETICIÓN RECIBIDA ---");
    if (isProving) {
        return res.status(503).json({ error: "busy", message: "Prover ocupado, intenta en un minuto." });
    }

    const jobIdStr = Date.now().toString();
    isProving = true;

    let publicValuesHex = req.body.publicValuesHex || (req.body.data && req.body.data.publicValuesHex);

    if (!publicValuesHex && req.body.sender) {
        try {
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            const isoRef = req.body.isoReference || "";
            const isoRefHash = ethers.keccak256(ethers.toUtf8Bytes(isoRef));
            const pqcRoot = req.body.pqcRoot || "0x0000000000000000000000000000000000000000000000000000000000000000";

            publicValuesHex = abiCoder.encode(
                ["tuple(address from, address to, uint256 amount, uint256 nonce, bytes32 pqcRoot, bytes32 isoRefHash, uint256 chainId, address token, uint256 deadline)"],
                [[
                    req.body.sender,
                    req.body.recipient,
                    ethers.parseUnits((req.body.amount || "0").toString(), req.body.decimals || 18),
                    BigInt(req.body.nonce || 0),
                    pqcRoot,
                    isoRefHash,
                    BigInt(56),
                    req.body.token,
                    BigInt(req.body.deadline || Math.floor(Date.now() / 1000) + 31536000)
                ]]
            );
        } catch (e) {
            isProving = false;
            return res.status(400).json({ error: "Fallo en la traducción", detalle: e.message });
        }
    }

    jobs[jobIdStr] = { status: "processing" };
    res.status(200).json({ success: true, jobId: jobIdStr, status: "processing" });

    // ✅ FIX: Escribir en el archivo que Rust SIEMPRE lee
    const inputFile = path.join(RUTA_PROYECTO_RUST, `publicValues_56.hex`);
    fs.writeFileSync(inputFile, publicValuesHex);

    // Borrar proofs viejos
    const proofFile = path.join(RUTA_PROYECTO_RUST, `proof_56.hex`);
    const pvFromProofFile = path.join(RUTA_PROYECTO_RUST, `publicValues_from_proof_56.hex`);
    try { fs.unlinkSync(proofFile); fs.unlinkSync(pvFromProofFile); } catch(e) {}

    const comando = `RUST_LOG=info ELF=${RUTA_ELF} GENESIS_DIR=. CHAIN_ID=56 cargo run --release --bin qrypta-genesis-prover`;

    exec(comando, { cwd: RUTA_PROYECTO_RUST, maxBuffer: 1024 * 1024 * 500 }, (error, stdout, stderr) => {
        isProving = false;
        if (!error && fs.existsSync(proofFile)) {
            const proofData = fs.readFileSync(proofFile, 'utf8').trim();
            // Leer los publicValues reales generados por el circuito
            let canonicalPV = publicValuesHex;
            if (fs.existsSync(pvFromProofFile)) {
                canonicalPV = fs.readFileSync(pvFromProofFile, 'utf8').trim();
            }
            jobs[jobIdStr] = { 
                status: "completed", 
                proof: proofData.startsWith('0x') ? proofData : '0x' + proofData,
                publicValues: canonicalPV.startsWith('0x') ? canonicalPV : '0x' + canonicalPV
            };
            console.log("✅ Proof generado correctamente.");
        } else {
            jobs[jobIdStr] = { status: "failed", error: "Error en Rust" };
            console.error("❌ Fallo en Rust");
        }
    });
});

app.get('/status/:jobId', (req, res) => {
    const job = jobs[req.params.jobId];
    if (!job) return res.status(404).json({ error: "No encontrado" });
    res.status(200).json(job);
});

app.listen(3001, () => console.log("🟢 Motor ZK-Tuple Corregido"));
