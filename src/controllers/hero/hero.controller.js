// controllers/hero/hero.controller.js
const heroService = require('../../services/hero/hero.service');

const getSlides = async (req, res, next) => {
  try {
    const result = await heroService.getSlides();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const saveSlide = async (req, res, next) => {
  try {
    const index = parseInt(req.params.index, 10);
    const result = await heroService.saveSlide(index, req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const saveAllSlides = async (req, res, next) => {
  try {
    const { slides } = req.body;
    const result = await heroService.saveAllSlides(slides);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const clearSlide = async (req, res, next) => {
  try {
    const index = parseInt(req.params.index, 10);
    const result = await heroService.clearSlide(index);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const resetAll = async (req, res, next) => {
  try {
    const result = await heroService.resetAll();
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSlides,
  saveSlide,
  saveAllSlides,
  clearSlide,
  resetAll
};
