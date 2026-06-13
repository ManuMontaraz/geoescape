const AssetResolver = {
  basePath: 'assets/images/icons/',
  customBase: 'assets/campaigns_custom/',

  icon(name, campaignId) {
    // Try campaign custom first
    if (campaignId) {
      const customPath = `${this.customBase}${campaignId}/images/icons/${name}.svg`;
      // We can't check existence synchronously, so we return custom if campaignId provided
      // The caller can fall back by catching image load errors
      return customPath;
    }
    return `${this.basePath}${name}.svg`;
  },

  itemIcon(name, campaignId) {
    // Items use global icons always
    return `${this.basePath}items/${name}.svg`;
  },

  npcIcon(name, campaignId) {
    // NPCs use global icons always
    return `${this.basePath}npcs/${name}.svg`;
  },

  decorIcon(name, campaignId) {
    // Decorative objects use global icons always
    return `${this.basePath}decor/${name}.svg`;
  },

  bgIcon(name, campaignId) {
    // Backgrounds are in assets/images/backgrounds/, NOT under icons/
    return `assets/images/backgrounds/bg_${name}.svg`;
  },

  locationIcon(name, campaignId) {
    // Location icons use global icons always
    return `${this.basePath}locations/${name}.svg`;
  },

  async exists(url) {
    try {
      const res = await fetch(url, {method: 'HEAD'});
      return res.ok;
    } catch (e) {
      return false;
    }
  }
};
