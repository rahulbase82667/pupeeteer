import { CheckRegisteration, Registeration } from "../controller/form.js";
import express from "express";
const router = express.Router();

router.post('/registeration', Registeration)
router.post('/check-registeration', CheckRegisteration)

export default router;
