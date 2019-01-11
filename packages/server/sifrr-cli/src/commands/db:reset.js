/* eslint no-case-declarations: 0 */
const seqCMD = 'PATH=$(npm bin):$PATH sequelize';
const path = require('path');
const exec = require('child_process').execSync;

module.exports = () => {
  require('../utils/check')(`${seqCMD} --version`, 'sequelize-cli is required to run this command. Install it by running `npm i sequelize-cli`');

  const configFile = require(path.resolve('./.sequelizerc')).config;
  const config = require(path.resolve(configFile))[ENV];

  global.console.log(`Using ${config.dialect} in ${ENV} environment`);

  switch(config.dialect) {
  case 'mysql':
    const mysql = require('mysql2');
    const con = mysql.createConnection({
      host: config.host,
      user: config.username,
      password: config.password,
      port: config.port || 3306,
      multipleStatements: true
    });

    con.connect(function(err) {
      if (err) throw err;
      global.console.log('Connected! \n');
      con.query(`DROP DATABASE IF EXISTS ${config.database}; CREATE DATABASE ${config.database};`, (err) => {
        con.close();
        if (err) throw err;
        global.console.log(`Database ${config.database} dropped and recreated.`);
        exec(`${seqCMD} db:migrate`);
      });
    });
    break;

  case 'postgres':
    const conn = `postgres://${config.username}:${config.password}@${config.host}/postgres`;
    const pg = require('pg');
    pg.connect(conn, (err, client) => {
      client.query(`DROP DATABASE IF EXISTS ${config.database}; CREATE DATABASE ${config.database}`, (err) => {
        if (err) throw err;
        global.console.log(`Database ${config.database} dropped and recreated.`);
        exec(`${seqCMD} db:migrate`);
      });
    });
    break;

  case 'mssql':
    const sql = require('mssql');
    sql.connect(`mssql://${config.username}:${config.password}@${config.host}`).then(() => {
      sql.query(`DROP DATABASE IF EXISTS ${config.database}; CREATE DATABASE ${config.database}`).then(() => {
        global.console.log(`Database ${config.database} dropped and recreated.`);
        exec(`${seqCMD} db:migrate`);
      }).catch((err) => {
        throw err;
      });
    });
    break;

  case 'sqlite':
    const sqlite = require('sqlite3');
    if (config.storage) exec(`rm ${config.storage}`);
    new sqlite.Database(config.storage || ':memory:',
      sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE,
      (err) => {
        if (err) throw err;
        global.console.log(`Database ${config.storage} dropped and recreated.`);
        exec(`${seqCMD} db:migrate`);
      });
    break;
  }
};
