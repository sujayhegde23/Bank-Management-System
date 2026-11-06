/**
 * ==============================================================================
 * Centralized Session Store Configuration (Feature 3)
 * ==============================================================================
 * Provides an explicit session store instance with fine-grained session inspection
 * and revocation capabilities for administrator access oversight.
 * ==============================================================================
 */

const session = require('express-session');

// Shared MemoryStore instance
const sessionStore = new session.MemoryStore();

/**
 * Revoke all active sessions belonging to a specific user ID.
 * Iterates through all registered sessions in the store and destroys matching entries.
 *
 * @param {number|string} userId - The numeric user_id in the MySQL users table
 * @returns {Promise<number>} Number of active sessions destroyed
 */
function revokeSessionsByUserId(userId) {
  return new Promise((resolve, reject) => {
    const targetUserId = Number(userId);
    if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
      return resolve(0);
    }

    sessionStore.all((err, sessions) => {
      if (err) return reject(err);
      if (!sessions || typeof sessions !== 'object') return resolve(0);

      const targetSids = [];

      for (const sid of Object.keys(sessions)) {
        const sess = sessions[sid];
        if (!sess) continue;

        let sessObj = sess;
        if (typeof sess === 'string') {
          try {
            sessObj = JSON.parse(sess);
          } catch (_) {
            continue;
          }
        }

        const sessUserId = sessObj?.user?.userId;
        if (sessUserId !== undefined && Number(sessUserId) === targetUserId) {
          targetSids.push(sid);
        }
      }

      if (targetSids.length === 0) {
        return resolve(0);
      }

      let destroyedCount = 0;
      let completed = 0;

      for (const sid of targetSids) {
        sessionStore.destroy(sid, (destroyErr) => {
          completed++;
          if (!destroyErr) {
            destroyedCount++;
          }
          if (completed === targetSids.length) {
            resolve(destroyedCount);
          }
        });
      }
    });
  });
}

module.exports = {
  sessionStore,
  revokeSessionsByUserId
};

