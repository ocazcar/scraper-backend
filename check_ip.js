/**
 * Script pour vérifier votre adresse IP actuelle
 * Utile pour confirmer que l'IP change quand vous passez en 4G
 * 
 * Usage: node check_ip.js
 */

const https = require('https');
const http = require('http');

async function getIP() {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.ip);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function getIPInfo(ip) {
  return new Promise((resolve, reject) => {
    https.get(`https://ipapi.co/${ip}/json/`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

async function main() {
  console.log('🔍 Vérification de votre adresse IP...\n');
  
  try {
    const ip = await getIP();
    console.log(`📍 Votre adresse IP: ${ip}`);
    
    const ipInfo = await getIPInfo(ip);
    if (ipInfo) {
      console.log(`\n📊 Informations:`);
      if (ipInfo.org) console.log(`   • Fournisseur: ${ipInfo.org}`);
      if (ipInfo.city) console.log(`   • Ville: ${ipInfo.city}`);
      if (ipInfo.region) console.log(`   • Région: ${ipInfo.region}`);
      if (ipInfo.country_name) console.log(`   • Pays: ${ipInfo.country_name}`);
    }
    
    console.log(`\n💡 Pour tester avec 4G:`);
    console.log(`   1. Activez le hotspot sur votre téléphone`);
    console.log(`   2. Connectez votre Mac au hotspot`);
    console.log(`   3. Relancez ce script pour voir la nouvelle IP`);
    console.log(`   4. Lancez le diagnostic: node test_all_services_diagnostic.js GH878CD`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

main();

