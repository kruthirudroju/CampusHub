const router = require('express').Router();
const c = require('../controllers/institutionController');

// Public -- needed before anyone can sign in
router.get('/', c.listInstitutions);
router.get('/:slug', c.getInstitutionBySlug);

module.exports = router;
