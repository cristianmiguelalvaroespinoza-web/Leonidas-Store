// --- CONFIGURACIÓN DE SERVICIOS ---
export const CONFIG = {
  CLOUDINARY_URL: `https://api.cloudinary.com/v1_1/dmqtycvmn/image/upload`,
  CLOUDINARY_PRESET: 'leonidas_preset',

  EMAILJS_SERVICE_ID: 'service_5aye42e',
  EMAILJS_TEMPLATE_ID: 'template_43j4dvh',
  EMAILJS_PUBLIC_KEY: 'LYMd0YBJQ-9sBWLxQ',
  ADMIN_EMAILS: "cristianmiguelalvaroespinoza@gmail.com,percycuentas33@gmail.com",

  EXCEL_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbztJgQoVuQxdNZqhlB1nF4Oygn60rBcAlC_tw7KuwQYzYaD8Kb8h9vXUghvqF52o3nB/exec",
  EXCEL_ONLINE_URL: "https://docs.google.com/spreadsheets/d/1rsV8xEyN7E90WNF1kbUPSaw3b6avrmYuqyKhoRgb4RU/edit",

  ADMIN_PASSWORD: "admin123"
};

// --- LISTAS PARA FORMULARIOS ---
export const OPCIONES_MARCAS = ["ASUS", "LENOVO", "HP", "DELL", "APPLE", "ACER", "MSI", "OTRO..."];

export const OPCIONES_RAM = ["4GB", "8GB", "12GB", "16GB", "20GB", "24GB", "32GB", "40GB", "64GB", "OTRO..."];

// Cambiado de OPCIONES_SSD a OPCIONES_ALMACENAMIENTO
export const OPCIONES_ALMACENAMIENTO = [
  "128GB SSD", "256GB SSD", "512GB SSD", "1TB SSD", "2TB SSD", 
  "128GB + 1TB", "256GB + 1TB", "512GB + 1TB", "OTRO..."
];

export const OPCIONES_PROCESADOR = [
  "Celeron / Pentium", "Core i3", "Core i5", "Core i7", "Core i9", 
  "Ryzen 3", "Ryzen 5", "Ryzen 7", "Ryzen 9", "Apple M1", "Apple M2", "Apple M3", "OTRO..."
];

export const OPCIONES_GPU = ["INTEGRADA", "RTX 2050", "RTX 3050", "RTX 4050", "RTX 4060", "GTX 1650", "OTRO..."];

export const OPCIONES_DESTINO = [
  "TIENDA (Fisica)", "TIENDA (Marketplace)", "San Juan de Lurigancho", "San Juan de Miraflores", "Jesus Maria", "Callao", "Cercado de Lima", "Surco", "La Molina", "San Borja", "San Isidro", "Miraflores", "Lince", "Breña", "Rimac", "Pueblo Libre", "Magdalena del Mar", "Villa El Salvador", "Villa Maria del Triunfo", "Ancón", "Carabayllo", "Comas", "Los Olivos", "Puente Piedra", "Santa Anita", "Santa Rosa", "Ventanilla",
  "OTRO..."
];

// Nueva constante para los estados (necesaria para el selector de la tabla)
export const OPCIONES_ESTADO = ["STOCK", "VENDIDO", "SEGUNDA"];

export const MODELOS_SUGERIDOS = {
  "LENOVO": ["Ideapad 3", "Ideapad 5", "Legion 5", "ThinkPad X1", "Yoga 7", "LOQ", "ideapad slim 3 15IAN8"],
  "ASUS": ["Vivobook 15", "Zenbook 14", "ROG Strix", "TUF Gaming F15", "ExpertBook"],
  "HP": ["Pavilion 15", "Victus 16", "EliteBook 840", "ProBook 450", "Envy x360"],
  "DELL": ["Inspiron 3520", "Latitude 5420", "XPS 13", "Vostro 3400", "Alienware m16"],
  "APPLE": ["MacBook Air M1", "MacBook Air M2", "MacBook Pro 14", "MacBook Pro 16"],
  "ACER": ["Aspire 5", "Nitro 5", "Swift 3", "Predator Helios"],
  "MSI": ["GF63 Thin", "Modern 14", "Katana GF66", "Stealth 15"]
};

// Asegúrate de que esta constante esté exportada correctamente
export const MAPA_GENERACIONES = {
  "Core i3": ["2da Gen", "3ra Gen", "4ta Gen", "5ta Gen", "6ta Gen", "7ma Gen", "8va Gen", "9na Gen", "10ma Gen", "11va Gen", "12va Gen", "13va Gen", "OTRO..."],
  "Core i5": ["2da Gen", "3ra Gen", "4ta Gen", "5ta Gen", "6ta Gen", "7ma Gen", "8va Gen", "9na Gen", "10ma Gen", "11va Gen", "12va Gen", "13va Gen", "14va Gen", "OTRO..."],
  "Core i7": ["2da Gen", "3ra Gen", "4ta Gen", "5ta Gen", "6ta Gen", "7ma Gen", "8va Gen", "9na Gen", "10ma Gen", "11va Gen", "12va Gen", "13va Gen", "14va Gen", "OTRO..."],
  "Core i9": ["9na Gen", "10ma Gen", "11va Gen", "12va Gen", "13va Gen", "14va Gen", "OTRO..."],
  "Ryzen 3": ["1ra Gen", "2da Gen", "3ra Gen", "4ta Gen", "5ta Gen", "7ma Gen", "OTRO..."],
  "Ryzen 5": ["1ra Gen", "2da Gen", "3ra Gen", "4ta Gen", "5ta Gen", "7ma Gen", "8va Gen", "OTRO..."],
  "Ryzen 7": ["1ra Gen", "2da Gen", "3ra Gen", "4ta Gen", "5ta Gen", "7ma Gen", "8va Gen", "OTRO..."],
  "Ryzen 9": ["3ra Gen", "4ta Gen", "5ta Gen", "7ma Gen", "8va Gen", "OTRO..."],
  "Celeron / Pentium": ["N Series", "J Series", "Gold", "Silver", "OTRO..."]
};

export const PRESETS_MODELOS = {
  "IDEAPAD SLIM 3 15IAN8": { procesador: "CORE I9", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4060" },
  "IDEAPAD 3": { procesador: "CORE I5", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "LEGION 5": { procesador: "CORE I7", generacion: "13VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4060" },
  "LOQ": { procesador: "RYZEN 7", generacion: "SERIE 7000", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "VIVOBOOK 15": { procesador: "CORE I5", generacion: "12VA GEN", ram: "12 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "TUF GAMING F15": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3050" },
  "ROG STRIX": { procesador: "CORE I9", generacion: "13VA GEN", ram: "32 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4070" },
  "VICTUS 16": { procesador: "CORE I5", generacion: "13VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "PAVILION 15": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "PROBOOK 450": { procesador: "CORE I5", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "INSPIRON 3520": { procesador: "CORE I3", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "INTEGRADA" },
  "LATITUDE 5420": { procesador: "CORE I7", generacion: "11VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "ALIENWARE M16": { procesador: "CORE I9", generacion: "13VA GEN", ram: "32 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4080" },
  "MACBOOK AIR M1": { procesador: "CHIP M1", generacion: "8 CORES", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "7 CORES" },
  "MACBOOK AIR M2": { procesador: "CHIP M2", generacion: "8 CORES", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "8 CORES" },
  "MACBOOK PRO 14": { procesador: "CHIP M3 PRO", generacion: "11 CORES", ram: "18 GB", almacenamiento: "512 GB SSD", gpu: "14 CORES" },
  "NITRO 5": { procesador: "CORE I5", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3050" },
  "ASPIRE 5": { procesador: "RYZEN 5", generacion: "SERIE 5000", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "GF63 THIN": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "KATANA GF66": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3060" }
};