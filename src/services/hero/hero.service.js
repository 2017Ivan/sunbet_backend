// services/hero/hero.service.js

const { HeroSlide } = require('../../models');
const CustomExceptions = require('../../middleware/CustomExceptions');
const responseBuilder = require('../../utils/response.builder');

const DEFAULT_SLIDES = [
  { slide_index: 0, badge: '🔥 New User Offer', badgeBg: 'rgba(255,255,255,0.15)', badgeBorder: 'rgba(255,255,255,0.25)', badgeColor: '#fff', title: '100% Welcome<br>Bonus Up To TZS 20K', titleColor: '#fff', sub: 'Deposit TZS 10,000 — play with TZS 20,000 instantly', cta: 'Claim Bonus', ctaBg: '#fff', ctaColor: '#1a0505', bg: 'linear-gradient(135deg,#3a0808 0%,#1a0505 50%,#0D0D0D 100%)', blob: 'rgba(163,45,45,0.25)', blob2: 'rgba(255,255,255,0.05)', route: '/auth/register', liveIndicator: false, thumb_league: 'Premier League', thumb_live: false, thumb_time: '19:45', thumb_home: 'Arsenal', thumb_homeShort: 'AR', thumb_homeColor: '#EF4444', thumb_homeOdds: '1.65', thumb_away: 'Chelsea', thumb_awayShort: 'CH', thumb_awayColor: '#3B82F6', thumb_awayOdds: '4.75', thumb_foot1: 'Over 2.5', thumb_foot2: 'Bet Now', thumb_foot2Color: '#fff', thumb_foot2Bg: '#A32D2D', thumb_foot3: '2+ Goals' },
  { slide_index: 1, badge: '🏆 Mega Jackpot', badgeBg: 'rgba(245,158,11,0.2)', badgeBorder: 'rgba(245,158,11,0.4)', badgeColor: '#F59E0B', title: '<span style="color:#F59E0B">TZS 50,000,000</span><br>Jackpot This Weekend', titleColor: '#fff', sub: 'Pick 13 correct results to win the biggest prize in Tanzania', cta: 'Play Jackpot', ctaBg: '#F59E0B', ctaColor: '#1a0a00', bg: 'linear-gradient(135deg,#2a1a00 0%,#3d2500 50%,#0D0D0D 100%)', blob: 'rgba(245,158,11,0.20)', blob2: 'rgba(245,158,11,0.08)', route: '/sports', liveIndicator: false, thumb_league: 'Jackpot Roller', thumb_live: false, thumb_time: 'Winner', thumb_home: 'Simba SC', thumb_homeShort: 'SB', thumb_homeColor: '#F59E0B', thumb_homeOdds: '1.90', thumb_away: 'Young Africans', thumb_awayShort: 'YA', thumb_awayColor: '#22C55E', thumb_awayOdds: '2.10', thumb_foot1: '13 Games', thumb_foot2: 'Play', thumb_foot2Color: '#1a0a00', thumb_foot2Bg: '#F59E0B', thumb_foot3: 'TZS 50M' },
  { slide_index: 2, badge: 'Live Now', badgeBg: 'rgba(255,59,59,0.2)', badgeBorder: 'rgba(255,59,59,0.4)', badgeColor: '#FF3B3B', title: '24 Matches<br>Live Right Now', titleColor: '#fff', sub: 'Real-time odds • Cash out anytime • In-play betting', cta: 'Watch Live', ctaBg: '#FF3B3B', ctaColor: '#fff', bg: 'linear-gradient(135deg,#001a3a 0%,#001228 50%,#0D0D0D 100%)', blob: 'rgba(56,125,255,0.20)', blob2: 'rgba(255,59,59,0.12)', route: '/live', liveIndicator: true, thumb_league: 'Serie A', thumb_live: true, thumb_time: '67′', thumb_home: 'Inter', thumb_homeShort: 'IN', thumb_homeColor: '#2563EB', thumb_homeOdds: '2.15', thumb_away: 'AC Milan', thumb_awayShort: 'MI', thumb_awayColor: '#DC2626', thumb_awayOdds: '3.10', thumb_score: '2 - 1', thumb_foot1: 'BTTS Yes', thumb_foot2: '1X2', thumb_foot2Color: '#fff', thumb_foot2Bg: '#FF3B3B', thumb_foot3: 'Match' },
  { slide_index: 3, badge: '⚡ Instant Withdrawal', badgeBg: 'rgba(34,197,94,0.2)', badgeBorder: 'rgba(34,197,94,0.4)', badgeColor: '#22C55E', title: 'Withdraw Via<br>M-Pesa In 3 Minutes', titleColor: '#fff', sub: 'No delays. No hidden fees. Your winnings, instantly.', cta: 'Withdraw Now', ctaBg: '#22C55E', ctaColor: '#001a0c', bg: 'linear-gradient(135deg,#002a14 0%,#001a0c 50%,#0D0D0D 100%)', blob: 'rgba(34,197,94,0.20)', blob2: 'rgba(34,197,94,0.08)', route: '/wallet', liveIndicator: false, thumb_league: 'Win · Cash Out', thumb_live: false, thumb_time: 'Instant', thumb_home: 'Balance: TZS', thumb_homeShort: 'TZ', thumb_homeColor: '#22C55E', thumb_homeOdds: '', thumb_away: 'Available Now', thumb_awayShort: '✔', thumb_awayColor: '#16A34A', thumb_awayOdds: 'M-Pesa', thumb_foot1: 'Deposit', thumb_foot2: 'Withdraw', thumb_foot2Color: '#001a0c', thumb_foot2Bg: '#22C55E', thumb_foot3: 'History' }
];

const formatSlide = (slide) => {
  if (!slide) return null;
  const data = slide.toJSON ? slide.toJSON() : slide;
  const thumb = {
    league: data.thumb_league || '',
    live: data.thumb_live || false,
    time: data.thumb_time || '',
    home: data.thumb_home || '',
    homeShort: data.thumb_homeShort || '',
    homeColor: data.thumb_homeColor || '',
    homeOdds: data.thumb_homeOdds || '',
    away: data.thumb_away || '',
    awayShort: data.thumb_awayShort || '',
    awayColor: data.thumb_awayColor || '',
    awayOdds: data.thumb_awayOdds || '',
    score: data.thumb_score || undefined,
    foot1: data.thumb_foot1 || '',
    foot2: data.thumb_foot2 || '',
    foot2Color: data.thumb_foot2Color || '',
    foot2Bg: data.thumb_foot2Bg || '',
    foot3: data.thumb_foot3 || '',
  };
  if (data.thumb_image) {
    thumb.image = data.thumb_image;
  }
  return {
    badge: data.badge,
    badgeBg: data.badgeBg,
    badgeBorder: data.badgeBorder,
    badgeColor: data.badgeColor,
    title: data.title,
    titleColor: data.titleColor,
    sub: data.sub,
    cta: data.cta,
    ctaBg: data.ctaBg,
    ctaColor: data.ctaColor,
    bg: data.bg,
    blob: data.blob,
    blob2: data.blob2,
    route: data.route,
    liveIndicator: data.liveIndicator,
    thumb,
  };
};

const getSlides = async () => {
  const slides = await HeroSlide.findAll({ order: [['slide_index', 'ASC']] });
  if (!slides || slides.length === 0) {
    const created = await HeroSlide.bulkCreate(DEFAULT_SLIDES);
    return responseBuilder.success({
      status: 200,
      message: 'Slides initialized',
      data: created.map(formatSlide)
    });
  }
  return responseBuilder.success({
    status: 200,
    message: 'Slides fetched',
    data: slides.map(formatSlide)
  });
};

const saveSlide = async (index, body) => {
  if (index < 0 || index > 3) throw new CustomExceptions('Invalid slide index', 400);

  const fields = ['badge', 'badgeBg', 'badgeBorder', 'badgeColor', 'title', 'titleColor', 'sub', 'cta', 'ctaBg', 'ctaColor', 'bg', 'blob', 'blob2', 'route', 'liveIndicator'];
  const thumbFields = ['image', 'league', 'live', 'time', 'home', 'homeShort', 'homeColor', 'homeOdds', 'away', 'awayShort', 'awayColor', 'awayOdds', 'score', 'foot1', 'foot2', 'foot2Color', 'foot2Bg', 'foot3'];

  const updateData = {};
  fields.forEach(f => {
    if (body[f] !== undefined) updateData[f] = body[f];
  });

  if (body.thumb) {
    if (body.thumb.image !== undefined) updateData.thumb_image = body.thumb.image;
    thumbFields.forEach(f => {
      const key = f === 'image' ? 'thumb_image' : `thumb_${f}`;
      if (body.thumb[f] !== undefined) updateData[key] = body.thumb[f];
    });
  }

  const [updated] = await HeroSlide.update(updateData, { where: { slide_index: index } });
  if (!updated) {
    await HeroSlide.create({ slide_index: index, ...updateData });
  }

  return responseBuilder.success({
    status: 200,
    message: `Slide ${index} saved`
  });
};

const saveAllSlides = async (slides) => {
  if (!Array.isArray(slides)) throw new CustomExceptions('Slides must be an array', 400);

  for (let i = 0; i < slides.length && i < 4; i++) {
    const s = slides[i];
    const updateData = {};
    ['badge', 'badgeBg', 'badgeBorder', 'badgeColor', 'title', 'titleColor', 'sub', 'cta', 'ctaBg', 'ctaColor', 'bg', 'blob', 'blob2', 'route', 'liveIndicator'].forEach(f => {
      if (s[f] !== undefined) updateData[f] = s[f];
    });
    if (s.thumb) {
      if (s.thumb.image !== undefined) updateData.thumb_image = s.thumb.image;
      ['league', 'live', 'time', 'home', 'homeShort', 'homeColor', 'homeOdds', 'away', 'awayShort', 'awayColor', 'awayOdds', 'score', 'foot1', 'foot2', 'foot2Color', 'foot2Bg', 'foot3'].forEach(f => {
        if (s.thumb[f] !== undefined) updateData[`thumb_${f}`] = s.thumb[f];
      });
    }

    const [updated] = await HeroSlide.update(updateData, { where: { slide_index: i } });
    if (!updated) {
      await HeroSlide.create({ slide_index: i, ...updateData });
    }
  }

  return responseBuilder.success({
    status: 200,
    message: 'All slides saved'
  });
};

const clearSlide = async (index) => {
  if (index < 0 || index > 3) throw new CustomExceptions('Invalid slide index', 400);
  await HeroSlide.update({ thumb_image: null }, { where: { slide_index: index } });
  return responseBuilder.success({
    status: 200,
    message: `Slide ${index} image cleared`
  });
};

const resetAll = async () => {
  await HeroSlide.destroy({ where: {} });
  const created = await HeroSlide.bulkCreate(DEFAULT_SLIDES);
  return responseBuilder.success({
    status: 200,
    message: 'Slides reset to defaults',
    data: created.map(formatSlide)
  });
};

module.exports = {
  getSlides,
  saveSlide,
  saveAllSlides,
  clearSlide,
  resetAll
};
