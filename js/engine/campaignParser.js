const CampaignParser = {
  async load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('No se pudo cargar el JSON');
    const json = await response.json();
    this.validate(json);
    return json;
  },

  validate(data) {
    if (!data.campaign_id) throw new Error('Falta campaign_id');
    if (!data.metadata) throw new Error('Falta metadata');
    if (!Array.isArray(data.locations)) {
      data.locations = [];
    }
    for (const loc of data.locations) {
      if (!loc.id) throw new Error('Location sin id');
      if (!loc.background && !loc.color && !loc.background_type) throw new Error(`Location ${loc.id} sin background, color ni background_type`);
    }
    return true;
  },

  getStartLocation(data) {
    if (!data.locations || data.locations.length === 0) return null;
    const startId = data.metadata.starting_location_id;
    if (!startId) return null;
    return data.locations.find(l => l.id === startId) || null;
  }
};
