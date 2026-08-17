import { Router, type IRouter } from "express";
import healthRouter from "./health";
import varunaRouter from "./varuna";

const router: IRouter = Router();

router.use(healthRouter);
router.use(varunaRouter);

export default router;
