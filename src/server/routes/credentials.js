import { Router } from 'express';

const router = Router();

export function setupCredentialsAPI(credentialsManager) {
  // POST /api/credentials - 保存凭証
  router.post('/api/credentials', async (req, res) => {
    try {
      const { username, password } = req.body;
      const userId = req.user?.id || req.body.userId;

      if (!username || !password) {
        return res.status(400).json({ error: 'username and password are required' });
      }

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      await credentialsManager.setCredential(userId, username, password);
      res.json({ success: true, message: 'Credential saved successfully' });
    } catch (error) {
      console.error('Error saving credential:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/credentials - 查詢凭証
  router.get('/api/credentials', async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const credential = await credentialsManager.getCredential(userId);

      if (!credential) {
        return res.status(404).json({ error: 'No credential found', data: null });
      }

      res.json({
        success: true,
        data: {
          username: credential.libraryUsername,
          savedAt: new Date(credential.createdAt).toISOString(),
          updatedAt: new Date(credential.updatedAt).toISOString()
        }
      });
    } catch (error) {
      console.error('Error retrieving credential:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/credentials - 刪除凭証
  router.delete('/api/credentials', async (req, res) => {
    try {
      const userId = req.user?.id || req.body.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const deleted = await credentialsManager.deleteCredential(userId);

      if (!deleted) {
        return res.status(404).json({ error: 'No credential to delete' });
      }

      res.json({ success: true, message: 'Credential deleted successfully' });
    } catch (error) {
      console.error('Error deleting credential:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default router;
