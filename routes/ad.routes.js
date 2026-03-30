const router = require("express").Router();
const adController = require("../controllers/ad.controller");
const { checkUserAuth, checkRole } = require("../middlewares/auth.middleware");
const multer = require("multer");

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Admin routes (protected)
router.post(
  "/",
  checkUserAuth,
  checkRole(["admin"]),
  upload.single("image"),
  adController.createAd,
);
router.get("/", checkUserAuth, checkRole(["admin"]), adController.getAllAds);
router.put(
  "/:adId",
  checkUserAuth,
  checkRole(["admin"]),
  upload.single("image"),
  adController.updateAd,
);
router.delete(
  "/:adId",
  checkUserAuth,
  checkRole(["admin"]),
  adController.deleteAd,
);

// Public routes for frontend
router.get("/public/:platform/:type", adController.getAdsByPlatformAndType);

module.exports = router;
