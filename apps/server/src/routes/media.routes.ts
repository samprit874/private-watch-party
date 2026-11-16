import { Router } from 'express';
import { z } from 'zod';
import { validateMediaUrl } from '../services/ssrfValidator.js';

export const mediaRouter = Router();

const ValidateUrlSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

mediaRouter.post('/validate-url', async (req, res) => {
  try {
    const { url } = ValidateUrlSchema.parse(req.body);
    const result = await validateMediaUrl(url);

    if (!result.isValid) {
      return res.status(400).json({
        isValid: false,
        error: result.error,
        message: 'The provided video URL is restricted or invalid.',
      });
    }

    return res.json({
      isValid: true,
      url,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
    }
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});
