const DB_NAME = 'GeoEscapeDB';
const DB_VERSION = 1;

const DB = {
  db: null,

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('campaigns')) db.createObjectStore('campaigns', {keyPath: 'id'});
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', {keyPath: 'campaignId'});
      };
    });
  },

  async saveCampaign(id, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('campaigns', 'readwrite');
      const store = tx.objectStore('campaigns');
      const req = store.put({id, json: data, savedAt: Date.now()});
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getCampaign(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('campaigns', 'readonly');
      const req = tx.objectStore('campaigns').get(id);
      req.onsuccess = () => resolve(req.result ? req.result.json : null);
      req.onerror = () => reject(req.error);
    });
  },

  async saveProgress(campaignId, state) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readwrite');
      const req = tx.objectStore('progress').put({campaignId, state, savedAt: Date.now()});
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getProgress(campaignId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readonly');
      const req = tx.objectStore('progress').get(campaignId);
      req.onsuccess = () => resolve(req.result ? req.result.state : null);
      req.onerror = () => reject(req.error);
    });
  }
};
