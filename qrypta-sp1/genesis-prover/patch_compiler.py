import os

# La ruta del archivo enfermo
archivo_objetivo = "/home/perera93/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/sp1-prover-5.2.4/build.rs"

# El código que queremos eliminar (el que descarga)
codigo_viejo = """    let client = reqwest::blocking::Client::builder().use_rustls_tls().build().unwrap();

    let response = client.get(url).send().unwrap();
    if !response.status().is_success() {
        panic!("Failed to download file: HTTP {}", response.status());
    }

    let bytes = response.bytes().unwrap();"""

# El código nuevo (el que lee tu archivo local)
# OJO: Usamos la ruta que tú ya verificaste que existe
codigo_nuevo = """    // --- PARCHE QRYPTA: BYPASS DE DESCARGA ---
    eprintln!(">>> USANDO ARCHIVO LOCAL vk-map-v5.0.0 <<<");
    let ruta_local = "/home/perera93/qrypta-sp1/vk-map-v5.0.0";
    let bytes = std::fs::read(ruta_local).expect("❌ ERROR: No se pudo leer el archivo local. Verifica que la ruta existe.");
    // -----------------------------------------"""

print(f"Abriendo {archivo_objetivo}...")

try:
    with open(archivo_objetivo, "r") as f:
        contenido = f.read()

    if codigo_viejo in contenido:
        # Reemplazamos el código malo por el bueno
        nuevo_contenido = contenido.replace(codigo_viejo, codigo_nuevo)
        
        # Guardamos el archivo operado
        with open(archivo_objetivo, "w") as f:
            f.write(nuevo_contenido)
            
        print("✅ ¡OPERACIÓN EXITOSA! El código ha sido parcheado.")
        print("Ahora Rust leerá tu archivo local en lugar de intentar descargarlo.")
    else:
        print("⚠️ NO SE ENCONTRÓ EL CÓDIGO EXACTO.")
        print("Puede que los espacios no coincidan. Vamos a intentar una búsqueda más agresiva...")
        # Intento de respaldo si fallan los espacios exactos
        parte_clave = 'let response = client.get(url).send().unwrap();'
        if parte_clave in contenido:
             print("Encontré la línea clave. Hazlo manual con nano si esto falla.")
        else:
             print("El archivo parece diferente a lo esperado.")

except FileNotFoundError:
    print("❌ Error: No encuentro el archivo build.rs. Verifica la ruta.")
except PermissionError:
    print("❌ Error de Permisos: Intenta correr esto con 'sudo' si falla.")

