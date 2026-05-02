/* One-off generator: node scripts/gen-employees-init-sql.js → sql/employees-init.sql */
const fs = require("fs");
const path = require("path");

const first = [
  "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth",
  "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Christopher", "Karen",
  "Daniel", "Lisa", "Matthew", "Nancy", "Anthony", "Betty", "Mark", "Margaret", "Donald", "Sandra",
  "Steven", "Ashley", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna", "Kenneth", "Michelle",
  "Kevin", "Carol", "Brian", "Amanda", "George", "Dorothy", "Edward", "Melissa", "Ronald", "Deborah",
  "Timothy", "Stephanie", "Jason", "Rebecca", "Jeffrey", "Laura", "Ryan", "Sharon", "Jacob", "Cynthia",
  "Gary", "Kathleen", "Nicholas", "Amy", "Eric", "Shirley", "Jonathan", "Angela", "Stephen", "Helen",
  "Larry", "Anna", "Justin", "Brenda", "Scott", "Pamela", "Brandon", "Nicole", "Benjamin", "Emma",
  "Samuel", "Rachel", "Gregory", "Janet", "Frank", "Catherine", "Raymond", "Maria", "Alexander", "Heather",
  "Patrick", "Diane", "Jack", "Ruth", "Dennis", "Julie",
];
const last = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
  "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes",
  "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper",
  "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
  "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
  "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez",
];
const depts = ["HR", "IT", "Sales", "Ops", "Legal"];
const cities = ["NYC", "LA", "Chicago", "Houston", "Miami"];
const countries = ["USA", "Canada", "UK", "USA", "Mexico"];

function fullName(empno) {
  const i = empno - 1;
  const fi = (i * 17 + Math.floor(i / first.length)) % first.length;
  const li = (i * 23 + Math.floor(i / 3)) % last.length;
  return first[fi] + " " + last[li];
}

function esc(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/** Cities must belong to the matching country (England, Scotland, Ireland, Wales). */
const SALES_COUNTRY_ORDER = ["England", "Scotland", "Ireland", "Wales"];
const SALES_CITIES = {
  England: [
    "London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Bristol", "Sheffield", "Newcastle",
    "Nottingham", "Southampton", "Oxford", "Cambridge", "Brighton", "Plymouth", "York", "Exeter",
    "Leicester", "Coventry", "Reading", "Portsmouth", "Norwich", "Hull", "Durham", "Ipswich",
    "Canterbury", "Lancaster", "Winchester", "Gloucester", "Derby", "Peterborough",
  ],
  Scotland: [
    "Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Inverness", "Stirling", "Perth", "Paisley",
    "Falkirk", "Dumfries", "Ayr", "Livingston", "Kilmarnock", "Dunfermline", "East Kilbride",
    "Hamilton", "Greenock", "Motherwell", "Rothesay", "Oban", "Fort William", "Kirkwall", "Elgin",
    "Galashiels", "Dumbarton",
  ],
  Ireland: [
    "Dublin", "Cork", "Limerick", "Galway", "Waterford", "Kilkenny", "Sligo", "Tralee", "Drogheda",
    "Dundalk", "Wexford", "Navan", "Athlone", "Carlow", "Letterkenny", "Ennis", "Mullingar",
    "Portlaoise", "Naas", "Bray", "Killarney", "Maynooth", "Tullamore", "Castlebar", "Roscommon",
    "Longford",
  ],
  Wales: [
    "Cardiff", "Swansea", "Newport", "Wrexham", "Barry", "Neath", "Merthyr Tydfil", "Caerphilly",
    "Bridgend", "Aberystwyth", "Bangor", "Rhyl", "Llanelli", "Pontypridd", "Cwmbran", "Colwyn Bay",
    "Porthcawl", "Conwy", "Ebbw Vale", "Holyhead", "St Davids", "Fishguard", "Haverfordwest",
    "Monmouth", "Brecon", "Abergavenny",
  ],
};
/** Quoted table name so SQLite keeps capital S. Products cycle through this list (all fit char(10)). */
const SQL_SALES_TABLE_Q = '"Sales"';
const SALES_PRODUCTS = [
  "Pepsi",
  "Coke",
  "Banana",
  "Apples",
  "Fanta",
  "Shampoo",
  "7up",
  "Pen",
  "Biscuits",
  "Stapler",
];

function salesCountryCity(rowIndex) {
  const i = rowIndex - 1;
  const country = SALES_COUNTRY_ORDER[i % 4];
  const list = SALES_CITIES[country];
  const city = list[Math.floor(i / 4) % list.length];
  return { country, city };
}

const lines = [];
lines.push("-- igniUp SQL practice: Employees (100 rows) + \"Sales\" (1000 rows, GB/IE cities).");
lines.push("-- Executed when the user clicks Initialize (and when the table is empty on first load).");
lines.push("");
lines.push("DROP TABLE IF EXISTS sales;");
lines.push("DROP TABLE IF EXISTS " + SQL_SALES_TABLE_Q + ";");
lines.push("DROP TABLE IF EXISTS employees;");
lines.push('DROP TABLE IF EXISTS "Employees";');
lines.push("");
lines.push('CREATE TABLE "Employees" (');
lines.push("  empno INTEGER,");
lines.push("  name TEXT,");
lines.push("  salary INTEGER,");
lines.push("  department TEXT,");
lines.push("  city TEXT,");
lines.push("  country TEXT");
lines.push(");");
lines.push("");
lines.push('INSERT INTO "Employees" (empno, name, salary, department, city, country) VALUES');

for (let i = 1; i <= 100; i++) {
  const sal = 35000 + ((i * 73) % 115000);
  const row =
    "(" +
    i +
    ", " +
    esc(fullName(i)) +
    ", " +
    sal +
    ", " +
    esc(depts[i % 5]) +
    ", " +
    esc(cities[i % 5]) +
    ", " +
    esc(countries[i % countries.length]) +
    ")" +
    (i < 100 ? "," : "");
  lines.push(row);
}
lines.push(";");
lines.push("");
lines.push(
  "-- \"Sales\": 1000 rows; country is England, Scotland, Ireland, or Wales; city is in that country."
);
lines.push(
  "CREATE TABLE " +
    SQL_SALES_TABLE_Q +
    " (product char(10), quantity integer, price float, city char(20), country char(20));"
);
lines.push("");
lines.push("INSERT INTO " + SQL_SALES_TABLE_Q + " (product, quantity, price, city, country) VALUES");

for (let r = 1; r <= 1000; r++) {
  const { country, city } = salesCountryCity(r);
  const product = SALES_PRODUCTS[(r - 1) % SALES_PRODUCTS.length];
  const quantity = 1 + ((r * 11) % 420);
  const price = Math.round((4.99 + ((r * 53) % 8000) / 7) * 100) / 100;
  const row =
    "(" +
    esc(product) +
    ", " +
    quantity +
    ", " +
    price +
    ", " +
    esc(city) +
    ", " +
    esc(country) +
    ")" +
    (r < 1000 ? "," : "");
  lines.push(row);
}
lines.push(";");

const out = path.join(__dirname, "..", "sql", "employees-init.sql");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("Wrote", out);
