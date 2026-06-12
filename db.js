const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'SLBFE_Coursework',
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
    trustServerCertificate:
      String(process.env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() === 'true'
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

function bindInputs(request, inputs = {}) {
  Object.entries(inputs).forEach(([key, value]) => {
    request.input(key, value);
  });
  return request;
}

async function query(statement, inputs = {}) {
  const pool = await getPool();
  const request = bindInputs(pool.request(), inputs);
  return request.query(statement);
}

module.exports = {
  sql,
  getPool,
  query,
  bindInputs
};
