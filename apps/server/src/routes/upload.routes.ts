import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller.js';

export const uploadRouter = Router();

uploadRouter.post('/init', UploadController.initUpload);
uploadRouter.put('/direct/:uploadId', UploadController.directUpload);
uploadRouter.post('/finalize', UploadController.finalizeUpload);
uploadRouter.post('/image', UploadController.uploadChatImage);
