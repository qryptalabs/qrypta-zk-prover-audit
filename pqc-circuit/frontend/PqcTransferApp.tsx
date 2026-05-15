import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  parseUnits,
  formatUnits,
  http,
  isAddress,
  keccak256,
  toHex,
  stringToBytes,
  encodeAbiParameters,
  parseAbiParameters
} from "viem";
import { bsc, mainnet } from "viem/chains";

const coreDao = {
  id: 1116,
  name: 'Core Blockchain Mainnet',
  nativeCurrency: { name: 'CORE', symbol: 'CORE', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.coredao.org/'] }, public: { http: ['https://rpc.coredao.org/'] } },
  blockExplorers: { default: { name: 'CoreScan', url: 'https://scan.coredao.org' } }
};
import {
  generatePQCKeyPair,
  savePQCKeyPair,
  loadPQCKeyPair,
  hasPQCKeyPair,
  pqcSign,
  getPQCRegistrationRoot,
  bytesToHex
} from "../../utils/pqcKeyManager";

const TOKEN_ADDRESS = "0x5266fe1aD9B035d0ED6142f1A70e9D6F102c8153";

const TOKEN_ABI = [
  {
    type: "function",
    name: "quantumTransferZK",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "publicValues", type: "bytes" },
      { name: "proofBytes", type: "bytes" },
      { name: "isoReference", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "registerQuantumKey",
    stateMutability: "nonpayable",
    inputs: [{ name: "pqcPublicKeyRoot", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "quantumPublicKeyRoots",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    type: "function",
    name: "pqcNonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "pqcNonce",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

type ChainKey = "bnb" | "eth" | "core";

const CHAINS: Record<ChainKey, { chainId: number; name: string; rpc: string; explorer: string; symbol: string }> = {
  bnb: {
    chainId: 56,
    name: "BNB Smart Chain (Mainnet)",
    rpc: "https://bsc-dataseed.binance.org/",
    explorer: "https://bscscan.com",
    symbol: "BNB"
  },
  eth: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpc: "https://cloudflare-eth.com",
    explorer: "https://etherscan.io",
    symbol: "ETH"
  },
  core: {
    chainId: 1116,
    name: "Core Blockchain Mainnet",
    rpc: "https://rpc.coredao.org/",
    explorer: "https://scan.coredao.org",
    symbol: "CORE"
  }
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const DICT = {
  en: {
    mainnetLive: "● Mainnet Live",
    title: "PQC Transfer",
    subtitle: "Post-Quantum Security (Falcon-512 + ZK-STARK)",
    connectWallet: "Connect Wallet",
    balance: "Qrypta Balance",
    changeAcc: "Change Account",
    verifying: "Verifying...",
    pqcActive: "PQC Identity: ✓",
    regReq: "Registration Required ⚠",
    unconnectedMsg: "Connect your wallet to access the quantum protocol.",
    actTitle: "⚠️ Activation Required",
    actMsg: "This address does not have a Post-Quantum identity registered in the contract. To make secure transfers, you must first generate and register your public key (Root).",
    btnRegNow: "⚡ Register PQC Identity Now",
    btnRegLoading: "Registering on Blockchain...",
    destLbl: "Recipient (Address)",
    destPh: "0x...",
    amountLbl: "Amount",
    maxLbl: "Max",
    memoLbl: "ISO 20022 Reference",
    memoPh: "Ex: Payment to Chase Bank, Invoice-2024-001, SWIFT CHASUS33...",
    memoHint: "This reference is permanently logged on-chain with your transfer.",
    memoSugg: "Suggestions:",
    btnGenPrf: "1. Generate ZK Proof",
    btnGenLdg: "Generating Proof...",
    btnGenDone: "Proof Ready ✓",
    btnSend: "2. Send (Mainnet)",
    btnSending: "Sending...",
    statRegReqTitle: "Registration Required",
    statRegReqMsg: "You must register your Post-Quantum Identity (PQC) before transacting on the network.",
    statSignRegTitle: "Signature Registered",
    statSignRegMsg: "Your PQC master key has been injected. Waiting for block confirmation...",
    statIdActTitle: "Quantum Identity Active",
    statIdActMsg: "Your key has been successfully linked to your wallet.",
    statZkGenTitle: "ZK-STARK Generated",
    statZkGenMsg: "The mathematical proof was successfully computed by the orchestrator. Now sign the transaction to inject it into the Blockchain.",
    statPqcFaultTitle: "PQC Connection Failure",
    statPqcFaultMsg: "Verify that the VPS is sending correct responses.",
    statTxSuccTitle: "Transfer Successful",
    statTxSuccMsg: "Your operation has been packed with Zero-Knowledge and registered permanently.",
    statFailNet: "Blockchain or Wallet transaction failed",
    statFailReg: "Failed to register PQC identity",
    txReceiptTitle: "Transaction Hash",
    btnExplorer: "View on Explorer",
    opNotif: "Operation Complete",
    errNotif: "An Error Occurred",
    statBusyTitle: "Servers Busy",
    statBusyMsg: "The cluster is currently computing a ZK proof for another user. Please wait a few minutes and try again to avoid overloading the node."
  },
  es: {
    mainnetLive: "● Mainnet Live",
    title: "Transferencia PQC",
    subtitle: "Seguridad Post-Cuántica (Falcon-512 + ZK-STARK)",
    connectWallet: "Conectar Wallet",
    balance: "Qrypta Balance",
    changeAcc: "Cambiar Cuenta",
    verifying: "Verificando...",
    pqcActive: "Identidad PQC: ✓",
    regReq: "Registro Requerido ⚠",
    unconnectedMsg: "Conecta tu wallet para acceder al protocolo cuántico.",
    actTitle: "⚠️ Activación Requerida",
    actMsg: "Esta dirección no tiene una identidad Post-Cuántica registrada en el contrato. Para realizar transferencias seguras, primero debes generar y registrar tu llave pública (Root).",
    btnRegNow: "⚡ Registrar Identidad PQC Ahora",
    btnRegLoading: "Registrando en Blockchain...",
    destLbl: "Destinatario (Address)",
    destPh: "0x...",
    amountLbl: "Monto",
    maxLbl: "Max",
    memoLbl: "Referencia ISO 20022",
    memoPh: "Ej: Pago a Banco Chase, Factura-2024-001, SWIFT CHASUS33...",
    memoHint: "Esta referencia queda grabada permanentemente on-chain con tu transferencia.",
    memoSugg: "Sugerencias:",
    btnGenPrf: "1. Generar Proof ZK",
    btnGenLdg: "Generando Proof...",
    btnGenDone: "Proof Listo ✓",
    btnSend: "2. Enviar (Mainnet)",
    btnSending: "Enviando...",
    statRegReqTitle: "Registro Requerido",
    statRegReqMsg: "Debes registrar tu identidad Post-Cuántica (PQC) antes de operar en la red.",
    statSignRegTitle: "Firma Registrada",
    statSignRegMsg: "Se ha inyectado tu llave maestra PQC. Esperando bloque de confirmación...",
    statIdActTitle: "Identidad Cuántica Activa",
    statIdActMsg: "Tu llave ha sido enlazada exitosamente a tu billetera.",
    statZkGenTitle: "ZK-STARK Generado",
    statZkGenMsg: "La prueba matemática fue generada con éxito por el orquestador. Ahora debes firmar la transacción para inyectarla en la Blockchain.",
    statPqcFaultTitle: "Fallo de Conexión PQC",
    statPqcFaultMsg: "Verifica que el VPS esté enviando respuestas correctas.",
    statTxSuccTitle: "Transferencia Exitosa",
    statTxSuccMsg: "Tu operación ha sido empaquetada con Zero-Knowledge y registrada permanentemente.",
    statFailNet: "El envío a la red o la billetera ha fallado",
    statFailReg: "Error al registrar la identidad PQC",
    txReceiptTitle: "Transaction Hash",
    btnExplorer: "Ver en Explorador",
    opNotif: "Operación Realizada",
    errNotif: "Ha Ocurrido un Error",
    statBusyTitle: "Servidores Ocupados",
    statBusyMsg: "El clúster está computando actualmente una prueba ZK para otro usuario. Por favor, espere un par de minutos y vuelva a intentarlo."
  }
};

function t(lang: string, key: keyof typeof DICT.en) {
  return DICT[lang as "es"|"en"]?.[key] || DICT.en[key] || key;
}

export default function PqcTransferApp({ lang = "es" }: { lang?: string }) {
  // In production use the CDN domain explicitly.
  const proverUrl = "https://api.providentquantum.tech";

  const [chain, setChain] = useState<ChainKey>("core");
  const [account, setAccount] = useState<string | null>(null);

  // Estados de transferencia
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("1");
  const [memo, setMemo] = useState<string>(""); // ISO 20022 Reference
  const [nonceAuto, setNonceAuto] = useState<string>("");
  const [generated, setGenerated] = useState<any | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', title?: string, msg: string, hash?: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-sync chain state with MetaMask's actual connected network on mount
  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const syncChain = async () => {
      try {
        const hexChainId: string = await eth.request({ method: 'eth_chainId' });
        const numId = parseInt(hexChainId, 16);
        if (numId === 56) setChain('bnb');
        else if (numId === 1) setChain('eth');
        else if (numId === 1116) setChain('core');
      } catch {}
    };
    syncChain();
    eth.on('chainChanged', (hexId: string) => {
      const numId = parseInt(hexId, 16);
      if (numId === 56) setChain('bnb');
      else if (numId === 1) setChain('eth');
      else if (numId === 1116) setChain('core');
    });
    return () => { eth.removeListener?.('chainChanged', () => {}); };
  }, []);

  // Datos exactos usados en la generación del proof (para re-codificar publicValues al enviar)
  const [proofPqcRoot, setProofPqcRoot] = useState<string>("0x0000000000000000000000000000000000000000000000000000000000000000");
  const [proofDeadline, setProofDeadline] = useState<number>(0);
  const [proofNonce, setProofNonce] = useState<string>("0");
  const [proofIsoRef, setProofIsoRef] = useState<string>("");

  // PQC Dilithium2 state
  const [hasPQCKey, setHasPQCKey] = useState<boolean>(false);
  const [showMemoSugg, setShowMemoSugg] = useState<boolean>(false);

  // ── ISO 20022 Message Builder ───────────────────────────────────────────
  const ISO_MESSAGES = [
    {
      code: "pacs.008",
      label: "pacs.008 — Customer Credit Transfer",
      desc: lang === "es" ? "Transferencia de crédito entre clientes (pago estándar entre empresas o personas)" : "Customer-to-customer credit transfer (standard payment between businesses or individuals)",
      priority: 1,
      fields: [
        { key: "endToEndId",    label: "End-to-End ID",                                   auto: true,  hint: lang==="es"?"Generado automáticamente: chainId + wallet + timestamp":"Auto-generated: chainId + wallet + timestamp" },
        { key: "msgId",         label: "Message ID",                                      auto: true,  hint: lang==="es"?"ID único del mensaje ISO":"Unique ISO message ID" },
        { key: "creditorBank",  label: lang==="es"?"Banco Destino":"Creditor Bank",       auto: false, ph: "Banco de Costa Rica",    hint: lang==="es"?"Nombre del banco receptor":"Receiving bank name" },
        { key: "remittanceInfo",label: lang==="es"?"Referencia / Factura":"Remittance Info", auto: false, ph: "INV-2024-00123",    hint: lang==="es"?"Número de factura o referencia":"Invoice number or reference" },
        { key: "purpose",       label: lang==="es"?"Propósito":"Purpose Code",            auto: false, ph: "SUPP",                   hint: "SUPP=Supplier, SALA=Salary, GDDS=Goods, TAXS=Tax" },
      ]
    },
    {
      code: "pacs.009",
      label: "pacs.009 — Financial Institution Credit Transfer",
      desc: lang === "es" ? "Transferencia entre instituciones financieras (liquidación interbancaria)" : "Credit transfer between financial institutions (interbank settlement)",
      priority: 2,
      fields: [
        { key: "instrId",       label: "Instruction ID",                                  auto: true,  hint: lang==="es"?"Generado automáticamente por QRYPTA":"Auto-generated by QRYPTA" },
        { key: "msgId",         label: "Message ID",                                      auto: true,  hint: lang==="es"?"ID único del mensaje ISO":"Unique ISO message ID" },
        { key: "debtorBIC",     label: "Debtor BIC / SWIFT",                             auto: false, ph: "BACCCRSJXXX",            hint: lang==="es"?"BIC del banco deudor":"Debtor bank BIC code" },
        { key: "creditorBIC",   label: "Creditor BIC / SWIFT",                           auto: false, ph: "CHASUS33XXX",            hint: lang==="es"?"BIC del banco acreedor":"Creditor bank BIC code" },
        { key: "sttlmAmt",      label: lang==="es"?"Monto Liquidación":"Settlement Amount", auto: false, ph: "1,000,000.00 USD",   hint: lang==="es"?"Monto total en moneda fiat":"Total fiat settlement amount" },
      ]
    },
    {
      code: "pacs.002",
      label: "pacs.002 — Payment Status Report",
      desc: lang === "es" ? "Reporte de estado del pago (aceptado, rechazado o pendiente)" : "Payment status report (accepted, rejected or pending)",
      priority: 3,
      fields: [
        { key: "msgId",         label: "Message ID",                                      auto: true,  hint: lang==="es"?"ID único del reporte":"Unique report ID" },
        { key: "orgnlMsgId",    label: lang==="es"?"ID Mensaje Original":"Original Message ID", auto: false, ph: "QRYP-20260425-A3F9", hint: lang==="es"?"Referencia del pago original a reportar":"Reference to the original payment" },
        { key: "txSts",         label: lang==="es"?"Estado del Pago":"Transaction Status", auto: false, ph: "ACCP",                 hint: "ACCP=Accepted, RJCT=Rejected, PDNG=Pending" },
        { key: "rsnCd",         label: lang==="es"?"Código de Razón":"Reason Code",      auto: false, ph: "AC01",                   hint: lang==="es"?"Código ISO de rechazo (si aplica)":"ISO rejection reason code (if applicable)" },
      ]
    },
    {
      code: "camt.054",
      label: "camt.054 — Credit/Debit Notification",
      desc: lang === "es" ? "Notificación de abono o cargo en cuenta bancaria" : "Credit or debit notification on a bank account",
      priority: 4,
      fields: [
        { key: "msgId",         label: "Message ID",                                      auto: true,  hint: lang==="es"?"ID único de la notificación":"Unique notification ID" },
        { key: "acctId",        label: lang==="es"?"ID de Cuenta (IBAN)":"Account ID (IBAN)", auto: false, ph: "CR21015202001026284066", hint: "IBAN / account number" },
        { key: "ntfctnTp",      label: lang==="es"?"Tipo de Movimiento":"Notification Type", auto: false, ph: "CRED",               hint: "CRED=Credit, DBIT=Debit" },
        { key: "addtlNtfctnInf",label: lang==="es"?"Información Adicional":"Additional Info", auto: false, ph: lang==="es"?"Abono transferencia QRYPTA":"QRYPTA transfer credit", hint: lang==="es"?"Descripción del movimiento":"Movement description" },
      ]
    },
    {
      code: "camt.053",
      label: "camt.053 — Bank-to-Customer Statement",
      desc: lang === "es" ? "Extracto bancario electrónico — anchored on-chain como prueba de estado de cuenta" : "Electronic bank statement — anchored on-chain as account state proof",
      priority: 5,
      fields: [
        { key: "msgId",         label: "Message ID",                                      auto: true,  hint: lang==="es"?"ID único del extracto":"Unique statement ID" },
        { key: "acctId",        label: lang==="es"?"ID de Cuenta (IBAN)":"Account ID (IBAN)", auto: false, ph: "CR21015202001026284066", hint: "IBAN / account number" },
        { key: "stmtPrd",       label: lang==="es"?"Período del Extracto":"Statement Period", auto: false, ph: "2026-04-01 / 2026-04-30", hint: lang==="es"?"Período cubierto por el extracto":"Statement coverage period" },
        { key: "closgBal",      label: lang==="es"?"Saldo de Cierre":"Closing Balance",  auto: false, ph: "50,000.00 USD",           hint: lang==="es"?"Saldo final del período":"Period closing balance" },
      ]
    },
    {
      code: "camt.052",
      label: "camt.052 — Intraday Report",
      desc: lang === "es" ? "Reporte de movimientos intradía de la cuenta" : "Intraday account movement report",
      priority: 6,
      fields: [
        { key: "msgId",         label: "Message ID",                                      auto: true,  hint: lang==="es"?"ID único del reporte intradía":"Unique intraday report ID" },
        { key: "acctId",        label: lang==="es"?"ID de Cuenta (IBAN)":"Account ID (IBAN)", auto: false, ph: "CR21015202001026284066", hint: "IBAN / account number" },
        { key: "rptgSeq",       label: lang==="es"?"Secuencia del Reporte":"Reporting Sequence", auto: false, ph: "1/3",           hint: lang==="es"?"N° de reporte del día (ej: 1/3 = primero de tres)":"Report sequence for the day" },
      ]
    },
    {
      code: "tsmt.001",
      label: "tsmt.001 — Trade Service Initiation",
      desc: lang === "es" ? "Carta de crédito y financiamiento de comercio exterior" : "Letter of credit and trade finance initiation",
      priority: 7,
      fields: [
        { key: "txId",          label: lang==="es"?"ID Transacción Comercial":"Trade Transaction ID", auto: true, hint: lang==="es"?"ID único de la carta de crédito, generado por QRYPTA":"Unique LC ID, auto-generated by QRYPTA" },
        { key: "msgId",         label: "Message ID",                                      auto: true,  hint: lang==="es"?"ID único del mensaje":"Unique message ID" },
        { key: "buyrBIC",       label: lang==="es"?"BIC Banco Comprador":"Buyer Bank BIC", auto: false, ph: "BACCCRSJXXX",          hint: lang==="es"?"BIC SWIFT del banco del comprador":"Buyer bank SWIFT BIC" },
        { key: "sellrBIC",      label: lang==="es"?"BIC Banco Vendedor":"Seller Bank BIC", auto: false, ph: "CHASUS33XXX",          hint: lang==="es"?"BIC SWIFT del banco del vendedor":"Seller bank SWIFT BIC" },
        { key: "goods",         label: lang==="es"?"Descripción de Bienes":"Goods Description", auto: false, ph: lang==="es"?"Café exportación 500 sacos":"500 bags export coffee", hint: lang==="es"?"Descripción de la mercancía o servicio":"Goods or services description" },
        { key: "portOfLdg",     label: lang==="es"?"Puerto de Embarque":"Port of Loading", auto: false, ph: lang==="es"?"Puerto Limón, Costa Rica":"Port of Limón, Costa Rica", hint: lang==="es"?"Puerto de salida de la mercancía":"Goods departure port" },
      ]
    },
    {
      code: "setr.004",
      label: "setr.004 — Redemption Order",
      desc: lang === "es" ? "Orden de redención de activos o tokens (valores tokenizados)" : "Asset or token redemption order (tokenized securities)",
      priority: 8,
      fields: [
        { key: "ordrRef",       label: lang==="es"?"Referencia de Orden":"Order Reference", auto: true, hint: lang==="es"?"Generado automáticamente por QRYPTA":"Auto-generated by QRYPTA" },
        { key: "finInstrmId",   label: lang==="es"?"Instrumento Financiero":"Financial Instrument", auto: true, hint: lang==="es"?"Token QRYPTA en BNB Chain (auto)":"QRYPTA token on BNB Chain (auto)" },
        { key: "units",         label: lang==="es"?"Unidades a Redimir":"Units to Redeem", auto: false, ph: "1000",                 hint: lang==="es"?"Cantidad de tokens a redimir":"Number of tokens to redeem" },
        { key: "dealPric",      label: lang==="es"?"Precio Acordado":"Deal Price",         auto: false, ph: "0.70 USD",             hint: lang==="es"?"Precio por unidad en moneda fiat":"Price per unit in fiat currency" },
      ]
    },
    {
      code: "sese.023",
      label: "sese.023 — Securities Settlement (DVP)",
      desc: lang === "es" ? "Liquidación atómica de valores: entrega versus pago (DVP) — ambas ocurren en la misma TX" : "Atomic securities settlement: delivery vs payment (DVP) — both happen in the same TX",
      priority: 9,
      fields: [
        { key: "sttlmId",       label: lang==="es"?"ID de Liquidación":"Settlement ID",   auto: true,  hint: lang==="es"?"Generado automáticamente (chainId + TX hash)":"Auto-generated (chainId + TX hash)" },
        { key: "finInstrmId",   label: lang==="es"?"Activo a Liquidar":"Asset to Settle", auto: true,  hint: lang==="es"?"Token QRYPTA en BNB Chain (auto)":"QRYPTA token on BNB Chain (auto)" },
        { key: "dlvrTp",        label: lang==="es"?"Tipo de Entrega":"Delivery Type",     auto: false, ph: "DVP",                   hint: "DVP=Delivery vs Payment, FOP=Free of Payment, SPST=Split Settlement" },
      ]
    },
    {
      code: "caaa.001",
      label: "caaa.001 — Card Payment Transaction",
      desc: lang === "es" ? "Transacción de pago con tarjeta cripto (punto de venta / POS)" : "Crypto card payment transaction (point of sale / POS)",
      priority: 10,
      fields: [
        { key: "txId",          label: lang==="es"?"ID de Transacción POS":"POS Transaction ID", auto: true, hint: lang==="es"?"Generado automáticamente por QRYPTA":"Auto-generated by QRYPTA" },
        { key: "mrchntNm",      label: lang==="es"?"Nombre del Comercio":"Merchant Name",  auto: false, ph: lang==="es"?"Supermercado La Colonia":"La Colonia Supermarket", hint: lang==="es"?"Nombre del establecimiento comercial":"Merchant establishment name" },
        { key: "terminalId",    label: "Terminal ID",                                       auto: false, ph: "POS-TRM-12345",         hint: lang==="es"?"ID de la terminal física de pago":"Physical payment terminal ID" },
      ]
    },
  ] as const;

  type ISOFieldKey = string;
  const [isoMsgType, setIsoMsgType] = useState<string>("pacs.008");
  const [isoFields, setIsoFields]   = useState<Record<ISOFieldKey, string>>({});

  const selectedISO = ISO_MESSAGES.find(m => m.code === isoMsgType) || ISO_MESSAGES[0];

  // Auto-generate unique IDs from wallet + chain + timestamp
  const genAutoValue = (key: string): string => {
    const ts   = Date.now().toString(36).toUpperCase();
    const wall = account ? account.slice(2, 8).toUpperCase() : "000000";
    const cid  = CHAINS[chain].chainId.toString();
    const rand = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
    switch (key) {
      case "msgId":       return `QRYP-${ts}-${rand}`;
      case "endToEndId":  return `E2E-${cid}-${wall}-${ts}`;
      case "instrId":     return `INST-${cid}-${wall}-${ts}`;
      case "txId":        return `TX-${cid}-${wall}-${ts}`;
      case "ordrRef":     return `ORD-${ts}-${rand}`;
      case "sttlmId":     return `SET-${cid}-${ts}-${rand}`;
      case "finInstrmId": return `QRYP-BEP20-BNB${cid}`;
      default:            return `AUTO-${ts}`;
    }
  };

  // Build ISO 20022 JSON reference string
  const buildIsoReference = () => {
    const payload: Record<string, string> = {
      msgType:   isoMsgType,
      version:   "ISO20022:2019",
      timestamp: new Date().toISOString(),
      chainId:   CHAINS[chain].chainId.toString(),
      initiator: account ? `${account.slice(0,6)}...${account.slice(-4)}` : "unknown",
    };
    (selectedISO.fields as readonly any[]).forEach((f) => {
      if (f.auto) {
        payload[f.key] = genAutoValue(f.key);
      } else if (isoFields[f.key]) {
        payload[f.key] = isoFields[f.key];
      }
    });
    return JSON.stringify(payload);
  };

  // Check PQC key on wallet connect
  useEffect(() => {
    if (account) setHasPQCKey(hasPQCKeyPair(account));
    else setHasPQCKey(false);
  }, [account]);

  // Estado Registro PQC
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [checkingReg, setCheckingReg] = useState<boolean>(false);
  // Detecta cuando la clave en el browser difiere de la registrada on-chain
  const [keyMismatch, setKeyMismatch] = useState<boolean>(false);
  const [onChainRoot, setOnChainRoot] = useState<string>("");
  
  // Saldo
  const [balance, setBalance] = useState<string>("0");

  const walletClient = useMemo(() => {
    if (typeof window === "undefined") return null;
    const eth = (window as any).ethereum;
    if (!eth) return null;
    return createWalletClient({ transport: custom(eth) });
  }, []);

  const publicClientFallback = useMemo(() => {
    return createPublicClient({ transport: http(CHAINS[chain].rpc) });
  }, [chain]);

  // Efecto: Cuando cambia la cuenta, verificamos si está registrada y leemos saldo
  useEffect(() => {
    if (account) {
      checkRegistration(account);
      fetchBalance(account);
    } else {
      setIsRegistered(false);
      setBalance("0");
    }
  }, [account]);

  async function fetchBalance(acc: string) {
    try {
      const b = await publicClientFallback.readContract({
        address: TOKEN_ADDRESS as any,
        abi: TOKEN_ABI as any,
        functionName: "balanceOf",
        args: [acc as any]
      });
      // @ts-ignore
      setBalance(formatUnits(b as bigint, 18));
    } catch (e) {
      console.error("Error leyendo saldo:", e);
      setBalance("0");
    }
  }

  async function ensureChain() {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error("MetaMask no detectado.");
    const target = CHAINS[chain].chainId;
    const hex = "0x" + target.toString(16);

    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e: any) {
      if (e?.code === 4902 || String(e?.message || "").includes("Unrecognized")) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: hex,
            chainName: CHAINS[chain].name,
            nativeCurrency: { name: CHAINS[chain].symbol, symbol: CHAINS[chain].symbol, decimals: 18 },
            rpcUrls: [CHAINS[chain].rpc],
            blockExplorerUrls: [CHAINS[chain].explorer]
          }]
        });
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
      } else {
        throw e;
      }
    }
  }

  async function checkRegistration(userAddress: string) {
    setCheckingReg(true);
    try {
      // Leemos directamente del contrato
      const root = await publicClientFallback.readContract({
        address: TOKEN_ADDRESS as any,
        abi: TOKEN_ABI as any,
        functionName: "quantumPublicKeyRoots",
        args: [userAddress as any]
      });

      const emptyRoot = "0x0000000000000000000000000000000000000000000000000000000000000000";
      const isReg = root !== emptyRoot;
      const rootStr = root as string;
      setIsRegistered(isReg);
      setOnChainRoot(rootStr);

      if (!isReg) {
          setKeyMismatch(false);
          setStatus({ type: 'info', title: t(lang, 'statRegReqTitle'), msg: t(lang, 'statRegReqMsg') });
      } else {
          // Comparar con la clave que tiene el browser en localStorage
          const kp = loadPQCKeyPair(userAddress);
          if (kp) {
            const browserRoot = getPQCRegistrationRoot(kp.publicKey) as string;
            const mismatch = browserRoot.toLowerCase() !== rootStr.toLowerCase();
            setKeyMismatch(mismatch);
            if (mismatch) {
              console.warn("[PQC] Key mismatch — on-chain:", rootStr, "| browser:", browserRoot);
            }
          } else {
            // No hay keypair en el browser — el usuario necesita re-generar
            setKeyMismatch(true);
          }
          const n = await fetchNonce(userAddress);
          setNonceAuto(n);
      }
    } catch (e) {
      console.error("Error checking registration:", e);
    } finally {
      setCheckingReg(false);
    }
  }

  async function connectWallet() {
    setStatus(null);
    try {
      if (!walletClient) throw new Error("MetaMask no detectado.");
      await ensureChain();
      const [addr] = await walletClient.requestAddresses();
      setAccount(addr);
    } catch (e: any) {
      setStatus({ type: 'error', msg: e?.message ?? String(e) });
    }
  }

  async function handleRegister() {
    setStatus(null);
    setLoading(true);
    try {
      if (!walletClient || !account) throw new Error("Wallet no conectada");
      await ensureChain();

      // Generamos keypair Dilithium2 real (NIST ML-DSA) si no existe
      let kp = loadPQCKeyPair(account);
      if (!kp) {
        kp = generatePQCKeyPair();
        savePQCKeyPair(account, kp);
      }
      setHasPQCKey(true);
      // pqcRoot = SHA256(dilithium2_publicKey) — matches formula inside pqcSign()
      // This is what the contract stores and what the ZK proof tuple contains.
      const uniqueRoot = getPQCRegistrationRoot(kp.publicKey) as `0x${string}`;

      console.log("[PQC] Registering SHA256(Dilithium2 pubkey) as root:", uniqueRoot);

      const getChainObj = () => {
        if (chain === 'bnb') return bsc;
        if (chain === 'eth') return mainnet;
        return coreDao;
      };

      const txHash = await walletClient.writeContract({
        chain: getChainObj() as any,
        address: TOKEN_ADDRESS as any,
        abi: TOKEN_ABI as any,
        functionName: "registerQuantumKey",
        args: [uniqueRoot],
        account: account as any
      });

      setStatus({ type: 'success', title: t(lang, 'statSignRegTitle'), msg: t(lang, 'statSignRegMsg'), hash: txHash });

      // Esperamos 5 segundos para asumir éxito (optimista)
      setTimeout(() => {
        setIsRegistered(true);
        setKeyMismatch(false);
        setStatus({ type: 'success', title: t(lang, 'statIdActTitle'), msg: t(lang, 'statIdActMsg') });
        setLoading(false);
        // Recargar nonce
        fetchNonce(account).then(setNonceAuto);
      }, 5000);

    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', msg: `${t(lang, 'statFailReg')}: ` + (e?.message || String(e)) });
      setLoading(false);
    }
  }

  // Actualiza la clave PQC: genera nueva si no hay en el browser, y re-registra on-chain
  async function handleUpdateKey() {
    setStatus(null);
    setLoading(true);
    try {
      if (!walletClient || !account) throw new Error("Wallet no conectada");
      await ensureChain();

      // Siempre generar un nuevo keypair y sobreescribir el local
      const kp = generatePQCKeyPair();
      savePQCKeyPair(account, kp);
      setHasPQCKey(true);

      const newRoot = getPQCRegistrationRoot(kp.publicKey) as `0x${string}`;
      console.log("[PQC] Updating key — new root:", newRoot);

      const getChainObj = () => {
        if (chain === 'bnb') return bsc;
        if (chain === 'eth') return mainnet;
        return coreDao;
      };

      const txHash = await walletClient.writeContract({
        chain: getChainObj() as any,
        address: TOKEN_ADDRESS as any,
        abi: TOKEN_ABI as any,
        functionName: "registerQuantumKey",
        args: [newRoot],
        account: account as any
      });

      setStatus({ type: 'success', title: lang === 'es' ? '🔄 Clave Actualizada' : '🔄 Key Updated', msg: lang === 'es' ? 'Tu nueva clave PQC ha sido registrada on-chain. Espera la confirmación del bloque.' : 'Your new PQC key has been registered on-chain. Wait for block confirmation.', hash: txHash });

      setTimeout(() => {
        setKeyMismatch(false);
        setOnChainRoot(newRoot);
        setStatus({ type: 'success', title: t(lang, 'statIdActTitle'), msg: t(lang, 'statIdActMsg') });
        setLoading(false);
        fetchNonce(account).then(setNonceAuto);
      }, 5000);

    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', msg: `${t(lang, 'statFailReg')}: ` + (e?.message || String(e)) });
      setLoading(false);
    }
  }


  async function fetchNonce(owner: string): Promise<string> {
    try {
        const n = await publicClientFallback.readContract({
            address: TOKEN_ADDRESS as any,
            abi: TOKEN_ABI as any,
            functionName: "pqcNonces",
            args: [owner as any]
        });
        return String(n);
    } catch {
        return "0";
    }
  }

  async function handleGenerateProof() {
    setStatus(null);
    setGenerated(null);
    setLoading(true);

    try {
      if (!account) throw new Error("Conecta tu wallet primero.");
      await ensureChain();

      if (!isAddress(recipient)) throw new Error("Dirección inválida.");
      if (!amount || Number(amount) <= 0) throw new Error("Monto inválido.");

      const n = await fetchNonce(account);
      setNonceAuto(n);

      let root = "0x0000000000000000000000000000000000000000000000000000000000000000";
      try {
          const _root = await publicClientFallback.readContract({
              address: TOKEN_ADDRESS as any,
              abi: TOKEN_ABI as any,
              functionName: "quantumPublicKeyRoots",
              args: [account as any]
          });
          if (_root) root = String(_root);
      } catch (err) {
          console.warn("Could not fetch remote PqcRoot, defaulting to 0x0", err);
      }

      // --- Real Dilithium2 PQC signing ---
      const isoRef = buildIsoReference();
      const exactDeadline = Math.floor(Date.now() / 1000) + 31536000;

      let pqcSignData: { publicKeyHex: string; signatureHex: string; pqcRoot: string } | null = null;

      if (account && hasPQCKeyPair(account)) {
        const kp = loadPQCKeyPair(account);
        if (kp) {
          const msgBytes = stringToBytes(
            `${account}:${recipient}:${amount}:${n}:${isoRef}:${exactDeadline}`
          );
          const signResult = pqcSign(msgBytes, kp.secretKey);
          pqcSignData = {
            publicKeyHex: signResult.publicKeyHex,
            signatureHex: signResult.signatureHex,
            pqcRoot: signResult.pqcRoot
          };
          // Only override root if signing root matches what's registered on THIS chain.
          // Different chains may have different registered roots (e.g. BNB vs Core).
          // Using the wrong root causes the on-chain check to revert.
          if (signResult.pqcRoot === root) {
            root = signResult.pqcRoot as `0x${string}`;
            console.log(`[PQC] Dilithium2 signed. pqcRoot matches on-chain: ${root}`);
          } else {
            console.warn(`[PQC] Local pqcRoot (${signResult.pqcRoot}) ≠ on-chain root (${root}). Using on-chain root for proof.`);
            // Still send signature for server-side PQC verification, but proof uses on-chain root
            pqcSignData.pqcRoot = root;
          }
        }
      }

      const body: Record<string, any> = {
        chain,
        token: TOKEN_ADDRESS,
        sender: account,
        recipient,
        amount,
        decimals: 18,
        memo: isoRef,
        isoReference: isoRef,
        nonce: String(n),
        pqcRoot: root,
        deadline: exactDeadline,
        fake: false
      };

      // Attach real Dilithium2 signature for server-side verification
      if (pqcSignData) {
        body.publicKey = pqcSignData.publicKeyHex;
        body.signature = pqcSignData.signatureHex;
        body.messageHex = bytesToHex(stringToBytes(
          `${account}:${recipient}:${amount}:${n}:${isoRef}:${exactDeadline}`
        ));
      }

      // Save exact proof params for re-encoding publicValues on-chain
      setProofPqcRoot(root);
      setProofDeadline(exactDeadline);
      setProofNonce(String(n));
      setProofIsoRef(isoRef);


      console.log("Solicitando prueba a:", `${proverUrl}/prove`, body);

      const r = await fetch(`${proverUrl}/prove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || j.busy || j.error === "busy") {
          if (r.status === 429 || r.status === 503 || j.busy || j.error === "busy") {
             throw new Error("SERVER_BUSY");
          }
          throw new Error(j.error || `Server Error: ${r.status} ${r.statusText}`);
      }

      if (j.success === false) throw new Error(j.error || "Error iniciando prueba ZK.");

      let finalData = null;

      if (j.jobId) {
        // Notificamos al usuario que el proceso tomará tiempo
        setStatus({ type: 'info', title: "Orquestando ZK-STARK", msg: "La red post-cuántica está computando el circuito criptográfico en segundo plano. Esto puede tomar entre 10 y 15 minutos. No cierre esta pestaña..." });
        
        // Iniciamos el Polling prometido
        finalData = await new Promise((resolve, reject) => {
           let attempts = 0;
           const interval = setInterval(async () => {
               try {
                   attempts++;
                   // Máximo de ~30 minutos (120 intentos x 15 seg)
                   if (attempts > 120) {
                       clearInterval(interval);
                       return reject(new Error("La prueba ZK excedió el tiempo máximo de espera establecido."));
                   }

                   const statusRes = await fetch(`${proverUrl}/status/${j.jobId}`);
                   const data = await statusRes.json();
                   if (data.status === 'completed') {
                        clearInterval(interval);
                        // Tolerancia: Si la prueba viene anidada en data.data o data.result, extraerla.
                        resolve(data.data || data.result || data); 
                    } else if (data.status === 'failed') {
                       clearInterval(interval);
                       reject(new Error(data.error || "La generación falló internamente en el nodo orquestador."));
                   }
                   // Si es 'pending', 'processing', simplemente el bucle continúa
               } catch (err) {
                   console.warn("Fallo de conexión temporal consultando estado...", err);
               }
           }, 15000); // 15 segundos
        });
      } else if (j.proof) {
        // Fallback por si el backend directo resuelve muy rápido y devuelve la prueba de una
        finalData = j;
      } else {
        throw new Error("El servidor PQC no ha devuelto un identificador de tarea válido.");
      }

      setGenerated(finalData);
      setStatus({ type: 'info', title: t(lang, 'statZkGenTitle'), msg: t(lang, 'statZkGenMsg') });
    } catch (e: any) {
      if (e.message === "SERVER_BUSY") {
        setStatus({
          type: 'error',
          title: t(lang, 'statBusyTitle'),
          msg: t(lang, 'statBusyMsg')
        });
      } else {
        setStatus({
          type: 'error',
          title: t(lang, 'statPqcFaultTitle'),
          msg: `${t(lang, 'statPqcFaultMsg')} (Error: ${e.message})`
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTransfer() {
    setStatus(null);
    setLoading(true);

    try {
      if (!walletClient || !account) throw new Error("MetaMask desconectado.");
      
      const realProof = generated?.proof || generated?.data?.proof || generated?.result?.proof;
      
      if (!realProof) throw new Error("Falta el Proof.");

      // ✅ Re-codificamos publicValues exactamente igual que el VPS (misma estructura, mismos datos)
      const isoRefExacto = proofIsoRef || memo || "PQC ZK TRANSFER";
      const isoRefHash = keccak256(toHex(stringToBytes(isoRefExacto))) as `0x${string}`;
      const amountWei = parseUnits(amount, 18);
      const deadlineBig = BigInt(proofDeadline || Math.floor(Date.now() / 1000) + 31536000);

      const realPub = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { type: 'address' },
              { type: 'address' },
              { type: 'uint256' },
              { type: 'uint256' },
              { type: 'bytes32' },
              { type: 'bytes32' },
              { type: 'uint256' },
              { type: 'address' },
              { type: 'uint256' }
            ]
          }
        ],
        [
          [
            account as `0x${string}`,
            recipient as `0x${string}`,
            amountWei,
            BigInt(proofNonce),
            proofPqcRoot as `0x${string}`,
            isoRefHash,
            BigInt(CHAINS[chain].chainId),
            TOKEN_ADDRESS as `0x${string}`,
            deadlineBig
          ] as any
        ]
      );

      // ✅ PRIORIDAD: usar publicValues del VPS (canónicos del circuito Rust)
      // Deben coincidir byte-a-byte con el proof matemático.
      // Solo usar los re-codificados como fallback de emergencia.
      const vpsPublicValues = generated?.publicValues || generated?.data?.publicValues || generated?.result?.publicValues;
      let finalPub = (vpsPublicValues && vpsPublicValues.length > 10)
        ? vpsPublicValues
        : realPub;
      
      // Ensure it has 0x prefix
      if (finalPub && !finalPub.startsWith("0x")) {
        finalPub = "0x" + finalPub;
      }

      await ensureChain();
      console.log("=== DEBUG TX ===");
      console.log("proofBytes (primeros 66 chars):", realProof?.substring(0, 66));
      console.log("publicValues length:", finalPub?.length, "bytes:", (finalPub?.length - 2) / 2);
      console.log("proofBytes length:", realProof?.length, "bytes:", (realProof?.length - 2) / 2);
      console.log("recipient:", recipient);
      console.log("amount:", amountWei.toString());
      console.log("chainId:", CHAINS[chain].chainId);

      const getChainObj = () => {
        if (chain === 'bnb') return bsc;
        if (chain === 'eth') return mainnet;
        return coreDao;
      };

      const txHash = await walletClient.writeContract({
        chain: getChainObj() as any,
        address: TOKEN_ADDRESS as any,
        abi: TOKEN_ABI as any,
        functionName: "quantumTransferZK",
        args: [
          recipient as any,
          amountWei,
          finalPub as any,
          realProof as any,
          isoRefExacto
        ],
        account: account as any,
        // Only Core DAO needs a fixed gas limit (to bypass viem's fee cap estimator)
        // BNB and ETH use automatic gas estimation from MetaMask
        ...(chain === 'core' ? { gas: 3_000_000n } : {}),
      });

      setStatus({ 
        type: 'success', 
        title: t(lang, 'statTxSuccTitle'),
        msg: t(lang, 'statTxSuccMsg'),
        hash: txHash 
      });
      
      setGenerated(null); // Limpiar para nueva operación
      setAmount("");
      setRecipient("");
      setMemo("");
      
      // Actualizar nonce y balance después de un rato (dar tiempo a que se mine el bloque)
      setTimeout(() => {
        fetchNonce(account!).then(setNonceAuto);
        fetchBalance(account!);
      }, 5000);

    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', msg: `${t(lang, 'statFailNet')}: ` + (e?.message || String(e)) });
    } finally {
      setLoading(false);
    }
  }

  // --- RENDERIZADO (UI) ---
  return (
    <div className="mx-auto max-w-4xl px-4 mt-8">
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-[#050505] p-6 md:p-10 shadow-2xl backdrop-blur-xl">

        {/* HEADER */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-400 tracking-wider uppercase animate-pulse">
              {t(lang, 'mainnetLive')}
            </div>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-white">
              {t(lang, 'title')}
            </h2>
            <p className="mt-2 text-white/50 text-sm">
              {t(lang, 'subtitle')}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Network Selector */}
            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-2xl p-1 backdrop-blur-md shadow-inner">
              {(Object.keys(CHAINS) as ChainKey[]).map(c => (
                <button
                  key={c}
                  onClick={() => { setChain(c); setAccount(null); }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                    chain === c 
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.2)]" 
                      : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent"
                  )}
                >
                  {CHAINS[c].symbol}
                </button>
              ))}
            </div>

            {!account ? (
              <button
                onClick={connectWallet}
                className="relative group overflow-hidden rounded-xl bg-white px-6 py-3 text-sm font-bold text-black hover:bg-emerald-400 transition-colors duration-300 shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(52,211,153,0.5)] w-full text-center"
              >
                {t(lang, 'connectWallet')}
              </button>
            ) : (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-2xl p-2 pl-4 backdrop-blur-md shadow-inner">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/80 mb-0.5">{t(lang, 'balance')}</span>
                    <div className="flex items-center gap-1.5">
                      <img src="/images/qrypta-logo.jpg" alt="Qrypta Token" className="w-4 h-4 rounded-full object-contain drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                      <span className="text-sm font-bold text-white">
                        {Number(balance).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 4})} <span className="text-emerald-400 text-[10px]">QRYPTA</span>
                      </span>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <button
                    onClick={connectWallet}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-emerald-200 transition-colors"
                    title={t(lang, 'changeAcc')}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                    {`${account.slice(0, 6)}...${account.slice(-4)}`}
                  </button>
                </div>
                
                <div className="mt-2 flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                  <div className="text-[9px] text-white/40 font-mono uppercase tracking-widest">
                    Nonce: {nonceAuto || "..."}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20"></div>
                  {checkingReg ? (
                     <div className="text-[9px] text-yellow-500 uppercase tracking-widest animate-pulse font-bold">{t(lang, 'verifying')}</div>
                  ) : isRegistered ? (
                     <div className="text-[9px] text-emerald-400 uppercase tracking-widest font-bold">{t(lang, 'pqcActive')}</div>
                  ) : (
                     <div className="text-[9px] text-red-400 uppercase tracking-widest font-bold animate-pulse">{t(lang, 'regReq')}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BODY - LOGICA DE BLOQUEO */}
        <div className="grid gap-6">
            
            {!account ? (
                // ESTADO 1: SIN CONECTAR
                <div className="p-8 text-center border border-white/5 rounded-2xl bg-white/5">
                    <p className="text-white/60 mb-4">{t(lang, 'unconnectedMsg')}</p>
                </div>

            ) : !isRegistered && !checkingReg ? (
                // ESTADO 2: CONECTADO PERO SIN REGISTRO (BLOQUEO)
                <div className="p-8 text-center border border-yellow-500/20 rounded-2xl bg-yellow-500/5">
                    <h3 className="text-xl font-bold text-yellow-400 mb-2">{t(lang, 'actTitle')}</h3>
                    <p className="text-white/70 mb-6 max-w-lg mx-auto">
                        {t(lang, 'actMsg')}
                    </p>
                    <button
                        onClick={handleRegister}
                        disabled={loading}
                        className="rounded-xl px-8 py-4 text-sm font-bold tracking-wide bg-yellow-500 text-black hover:bg-yellow-400 transition-all shadow-lg hover:shadow-yellow-500/20"
                    >
                        {loading ? t(lang, 'btnRegLoading') : t(lang, 'btnRegNow')}
                    </button>
                </div>

            ) : (
                // ESTADO 3: REGISTRADO Y LISTO (FORMULARIO)
                <>
                    {/* ⚠️ KEY MISMATCH BANNER — aparece cuando la clave del browser difiere de la on-chain */}
                    {keyMismatch && (
                      <div className="p-5 border border-orange-500/40 rounded-2xl bg-orange-500/10 backdrop-blur-sm">
                        <div className="flex items-start gap-4">
                          <div className="text-2xl flex-shrink-0">⚠️</div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-orange-400 mb-1">
                              {lang === 'es' ? 'Clave PQC Desincronizada' : 'PQC Key Out of Sync'}
                            </h3>
                            <p className="text-sm text-white/70 mb-3">
                              {lang === 'es'
                                ? 'La clave cuántica en este navegador no coincide con la registrada on-chain. Esto puede ocurrir si cambiaste de dispositivo o se borró el almacenamiento local. Debes actualizar tu clave antes de generar un proof.'
                                : 'The quantum key in this browser does not match the one registered on-chain. This can happen if you changed devices or local storage was cleared. You must update your key before generating a proof.'}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={handleUpdateKey}
                                disabled={loading}
                                className="rounded-xl px-6 py-3 text-sm font-bold tracking-wide bg-orange-500 text-black hover:bg-orange-400 transition-all shadow-lg hover:shadow-orange-500/30 disabled:opacity-50"
                              >
                                {loading
                                  ? (lang === 'es' ? 'Registrando...' : 'Registering...')
                                  : (lang === 'es' ? '🔑 Generar y Actualizar Quantum Key' : '🔑 Generate & Update Quantum Key')}
                              </button>
                            </div>
                            <p className="text-[10px] text-white/30 mt-2 font-mono">
                              {lang === 'es' ? 'Clave on-chain: ' : 'On-chain root: '}
                              {onChainRoot ? `${onChainRoot.slice(0,10)}...${onChainRoot.slice(-6)}` : '...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-white/60 ml-1">{t(lang, 'destLbl')}</label>

                        <input
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            placeholder={t(lang, 'destPh')}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-white placeholder:text-white/20 outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all font-mono"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-white/60 ml-1">{t(lang, 'amountLbl')}</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.0"
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-white placeholder:text-white/20 outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all font-mono"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button 
                                      onClick={() => setAmount(balance)}
                                      className="px-2 py-1 text-[10px] font-bold bg-white/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors uppercase tracking-widest"
                                    >
                                      {t(lang, 'maxLbl')}
                                    </button>
                                    <div className="text-xs font-bold text-white/40 mr-2">QRYPTA</div>
                                </div>
                            </div>
                        </div>

                        {/* ── ISO 20022 Message Builder ─────────────────────────────── */}
                        <div className="col-span-1 md:col-span-2 space-y-3">

                          {/* Header */}
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-xs font-semibold text-white/60 uppercase tracking-widest">
                              {lang === "es" ? "Mensaje ISO 20022" : "ISO 20022 Message"}
                            </label>
                            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/80 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              on-chain · ZK anchored
                            </span>
                          </div>

                          {/* Message type selector */}
                          <div className="relative">
                            <select
                              value={isoMsgType}
                              onChange={e => { setIsoMsgType(e.target.value); setIsoFields({}); }}
                              className="w-full rounded-xl border border-emerald-500/30 bg-[#0a1628] px-4 py-3.5 text-emerald-300 font-mono text-sm outline-none focus:border-emerald-400 transition-all appearance-none cursor-pointer"
                            >
                              {ISO_MESSAGES.map(m => (
                                <option key={m.code} value={m.code}>{m.label}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                            </div>
                          </div>

                          {/* Description */}
                          <div className="flex items-start gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2.5">
                            <span className="text-emerald-400 text-base mt-0.5">📋</span>
                            <p className="text-[11px] text-white/50 leading-relaxed">{selectedISO.desc}</p>
                          </div>

                          {/* Fields — auto vs user */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(selectedISO.fields as readonly any[]).map((f) => (
                              <div key={f.key} className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <label className={`text-[10px] font-mono uppercase tracking-wider ${f.auto ? "text-emerald-500/70" : "text-white/50"}`}>
                                    {f.label}
                                  </label>
                                  {f.auto && (
                                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-500/60 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0 rounded-full">
                                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                      AUTO
                                    </span>
                                  )}
                                </div>
                                {f.auto ? (
                                  <div className="w-full rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-emerald-400/70 text-sm font-mono flex items-center gap-2 min-h-[42px]">
                                    <svg className="w-3 h-3 text-emerald-500/40 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    <span className="text-[11px] italic text-emerald-400/50">{genAutoValue(f.key)}</span>
                                  </div>
                                ) : (
                                  <input
                                    value={isoFields[f.key] || ""}
                                    onChange={e => setIsoFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    placeholder={f.ph}
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/20 text-sm font-mono outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] transition-all"
                                  />
                                )}
                                <p className={`text-[10px] px-0.5 ${f.auto ? "text-emerald-500/40" : "text-white/25"}`}>{f.hint}</p>
                              </div>
                            ))}
                          </div>

                          {/* Live preview of what will be stored on-chain */}
                          <details className="group">
                            <summary className="cursor-pointer text-[10px] text-white/30 font-mono hover:text-emerald-400/60 transition-colors flex items-center gap-1.5 select-none">
                              <svg className="w-3 h-3 group-open:rotate-90 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                              {lang === "es" ? "Ver JSON que se grabará on-chain" : "Preview JSON stored on-chain"}
                            </summary>
                            <pre className="mt-2 p-3 bg-black/40 border border-white/5 rounded-lg text-[10px] text-emerald-300/60 font-mono overflow-x-auto leading-relaxed">
                              {buildIsoReference()}
                            </pre>
                          </details>

                        </div>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleGenerateProof}
                            disabled={loading || !!generated}
                            className={cn(
                                "flex-1 rounded-xl px-6 py-4 text-sm font-bold tracking-wide transition-all duration-300",
                                generated
                                ? "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40"
                            )}
                        >
                            {loading && !generated ? t(lang, 'btnGenLdg') : generated ? t(lang, 'btnGenDone') : t(lang, 'btnGenPrf')}
                        </button>

                        <button
                            onClick={handleSendTransfer}
                            disabled={loading || !generated}
                            className={cn(
                                "flex-1 rounded-xl px-6 py-4 text-sm font-bold tracking-wide transition-all duration-300",
                                generated
                                ? "bg-emerald-600 text-white shadow-lg hover:shadow-emerald-500/50 hover:scale-[1.02]"
                                : "bg-white/5 text-white/20 border border-white/5 cursor-not-allowed"
                            )}
                        >
                            {loading && generated ? t(lang, 'btnSending') : t(lang, 'btnSend')}
                        </button>
                    </div>
                </>
            )}
        </div>

        {/* STATUS MSG - REDISEÑADO */}
        {status && (
          <div className="mt-8 relative overflow-hidden">
            {/* Animación de entrada opcional (se delega a CSS, pero estructuramos bien los tags) */}
            <div className={cn(
              "relative p-6 rounded-2xl border shadow-2xl transition-all duration-500 ease-out",
              status.type === 'error' ? "border-red-500/30 bg-[#0f0505] shadow-[0_10px_40px_rgba(239,68,68,0.15)]" :
              status.type === 'success' ? "border-emerald-500/30 bg-[#05110a] shadow-[0_10px_40px_rgba(16,185,129,0.15)]" :
              "border-blue-500/30 bg-[#050a11] shadow-[0_10px_40px_rgba(59,130,246,0.15)]"
            )}>
              {/* Backlight Ambiental */}
              <div className={cn(
                "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[60px] pointer-events-none opacity-40",
                status.type === 'error' ? "bg-red-500" :
                status.type === 'success' ? "bg-emerald-500" :
                "bg-blue-500"
              )}></div>

              <div className="flex flex-col sm:flex-row gap-5 items-start relative z-10">
                
                {/* Ícono de Estado */}
                <div className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center shadow-inner",
                  status.type === 'error' ? "border-red-500/40 bg-red-500/10 text-red-400" :
                  status.type === 'success' ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" :
                  "border-blue-500/40 bg-blue-500/10 text-blue-400"
                )}>
                  {status.type === 'success' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  )}
                  {status.type === 'error' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  {status.type === 'info' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                </div>

                {/* Contenido */}
                <div className="flex-1 w-full">
                  <h4 className={cn(
                    "font-bold text-lg mb-1 tracking-tight",
                    status.type === 'error' ? "text-red-300" :
                    status.type === 'success' ? "text-emerald-300" :
                    "text-blue-300"
                  )}>
                    {status.title || (status.type === 'success' ? t(lang, 'opNotif') : status.type === 'error' ? t(lang, 'errNotif') : 'Notificación')}
                  </h4>
                  <p className="text-white/70 text-sm leading-relaxed mb-4">
                    {status.msg}
                  </p>
                  
                  {/* Recibo Hash */}
                  {status.hash && (
                    <div className="mt-4 p-4 rounded-xl bg-black/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-white/30 mb-1">{t(lang, 'txReceiptTitle')}</span>
                        <span className="font-mono text-xs text-white/80 break-all">{status.hash}</span>
                      </div>
                      
                      <a
                        href={`${CHAINS[chain].explorer}/tx/${status.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition-all text-xs font-bold uppercase tracking-wide"
                      >
                        {t(lang, 'btnExplorer')}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
