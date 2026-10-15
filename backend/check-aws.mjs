import { BedrockService, publicError } from './bedrock.mjs';
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
process.env.AWS_EC2_METADATA_DISABLED = 'true';
const service = new BedrockService();
try {
  const status = await service.connect();
  console.log(JSON.stringify({ connected: status.connected, region: status.region, modelId: status.modelId }));
} catch (error) { console.error(JSON.stringify(publicError(error))); process.exitCode = 1; }
finally { service.client.destroy(); }
