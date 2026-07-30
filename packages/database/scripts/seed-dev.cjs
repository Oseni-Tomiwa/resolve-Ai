if (process.env.NODE_ENV === 'production') throw new Error('Development seed data is not available in production');
console.info(JSON.stringify({ event: 'database.seed_skipped', reason: 'No development fixtures are configured for this repository' }));
