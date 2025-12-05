/**
 * Serveur Express pour l'API de scraping
 */

// Charger dotenv EN PREMIER pour que les variables soient disponibles
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { scrapeMidasPrice } = require('./scrape_midas');
const { getPrice } = require('./api_price_cache');
const { runPartsLookup } = require('./parts_scraper');
const { supabase } = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Configuration CORS pour autoriser les requêtes depuis le frontend
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:5173',
  // Ajoutez votre domaine Vercel ici en production
  // 'https://votre-domaine.com',
].filter(Boolean); // Retire les valeurs undefined

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*', // En dev, autorise tout. En prod, utilisez la liste
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Endpoint pour scraper Midas
app.post('/api/scrape/midas', async (req, res) => {
  try {
    const { brand, model, year, plate, service } = req.body;
    
    if (!brand || !model) {
      return res.status(400).json({
        success: false,
        error: 'Marque et modèle sont requis',
      });
    }
    
    console.log(`📥 Requête de scraping Midas: ${brand} ${model} ${year || ''} - ${service || 'plaquettes-de-frein-avant'}`);
    
    const result = await scrapeMidasPrice(
      brand,
      model,
      year,
      service || 'plaquettes-de-frein-avant'
    );
    
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur dans /api/scrape/midas:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint pour scraper Norauto (à implémenter)
app.post('/api/scrape/norauto', async (req, res) => {
  try {
    const { brand, model, year, plate, service } = req.body;
    
    if (!brand || !model) {
      return res.status(400).json({
        success: false,
        error: 'Marque et modèle sont requis',
      });
    }
    
    // TODO: Implémenter le scraping Norauto
    res.status(501).json({
      success: false,
      error: 'Scraping Norauto pas encore implémenté',
    });
  } catch (error) {
    console.error('❌ Erreur dans /api/scrape/norauto:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint pour récupérer un prix (avec cache)
app.post('/api/price', async (req, res) => {
  try {
    const { prestationId, plate, vehicleInfo, selection } = req.body;
    
    // Cas spécial : "Les deux" (avant + arrière)
    // Si prestationId est null mais qu'on a une sélection "les-deux", on doit calculer les deux prix
    if (!prestationId && selection && (selection === 'les-deux' || selection === 'Les deux')) {
      const { serviceSlug } = req.body;
      if (!serviceSlug) {
        return res.status(400).json({
          success: false,
          error: 'serviceSlug est requis pour calculer "Les deux"',
        });
      }
      console.log(`📥 Requête spéciale "Les deux" détectée pour ${serviceSlug} - ${plate}`);
      const { getPriceForBoth } = require('./api_price_cache');
      const result = await getPriceForBoth(serviceSlug, plate, vehicleInfo);
      
      if (result.success) {
        return res.json({
          success: true,
          price: result.price,
          cached: result.cached,
          vehicleKey: result.vehicleKey
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Erreur lors de la récupération du prix'
        });
      }
    }
    
    if (!prestationId || !plate || !vehicleInfo) {
      return res.status(400).json({
        success: false,
        error: 'prestationId, plate et vehicleInfo sont requis',
      });
    }
    
    // Vérifier que vehicleInfo contient les informations nécessaires
    if (!vehicleInfo.brand || !vehicleInfo.model) {
      return res.status(400).json({
        success: false,
        error: 'vehicleInfo doit contenir brand et model',
      });
    }
    
    console.log(`📥 Requête de prix: ${prestationId} pour ${plate} (${vehicleInfo.brand} ${vehicleInfo.model})`);
    
    const result = await getPrice(prestationId, plate, vehicleInfo, selection);
    
    if (result.success) {
      res.json({
        success: true,
        price: result.price,
        cached: result.cached,
        vehicleKey: result.vehicleKey
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Erreur lors de la récupération du prix'
      });
    }
  } catch (error) {
    console.error('❌ Erreur dans /api/price:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur inconnue',
    });
  }
});

// Endpoint pour récupérer les codes fournisseurs via 7ZAP
app.post('/api/parts/codes', async (req, res) => {
  try {
    const { vin, prestationKey, serviceName } = req.body || {};

    if (!vin || !prestationKey) {
      return res.status(400).json({
        success: false,
        error: 'vin et prestationKey sont requis',
      });
    }

    console.log(`📦 Requête codes fournisseurs: ${serviceName || ''} – VIN ${vin} (${prestationKey})`);

    const data = await runPartsLookup({ vin, prestationKey });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Erreur dans /api/parts/codes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la récupération des codes fournisseurs',
    });
  }
});

// Endpoint pour créer un rendez-vous (planning Benjamin)
app.post('/api/appointments', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: 'Supabase non configuré côté serveur',
      });
    }

    const appointment = req.body?.appointment || req.body;
    if (!appointment || typeof appointment !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Payload appointment manquant',
      });
    }

    const requiredFields = ['client_name', 'service', 'appointment_date', 'appointment_time'];
    const missing = requiredFields.filter((field) => !appointment[field]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Champs requis manquants: ${missing.join(', ')}`,
      });
    }

    const durationMinutes = Number(appointment.duration_minutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'duration_minutes doit être un nombre positif',
      });
    }

    const payload = {
      ...appointment,
      duration_minutes: durationMinutes,
      client_name: appointment.client_name.trim(),
      client_phone: appointment.client_phone?.trim() || null,
      client_email: appointment.client_email?.trim() || null,
      status: appointment.status || 'confirme',
      technician: appointment.technician || 'Benjamin',
      created_at: appointment.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('📅 Création d\'un rendez-vous côté serveur:', {
      date: payload.appointment_date,
      time: payload.appointment_time,
      service: payload.service,
      client: payload.client_name,
    });

    const { data, error } = await supabase
      .from('appointments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur Supabase /appointments:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erreur Supabase lors de la création du rendez-vous',
        details: error.details || null,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Erreur dans /api/appointments:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la création du rendez-vous',
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur de scraping démarré sur le port ${PORT}`);
  console.log(`📡 Endpoints disponibles:`);
  console.log(`   POST /api/scrape/midas`);
  console.log(`   POST /api/scrape/norauto`);
  console.log(`   POST /api/price (avec cache)`);
  console.log(`   GET  /health`);
});

