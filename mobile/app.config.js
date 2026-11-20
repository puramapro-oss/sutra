const { normalizeProjectId } = require("./lib/eas-project");

module.exports = ({ config }) => {
  const fromEnvironment = process.env.EAS_PROJECT_ID;
  const fromConfig = config.extra?.eas?.projectId;
  const environmentId = normalizeProjectId(fromEnvironment);
  const configuredId = normalizeProjectId(fromConfig);
  if ((fromEnvironment && !environmentId) || (fromConfig && !configuredId)) {
    throw new Error("SUTRA requires a valid EAS project UUID.");
  }
  if (environmentId && configuredId && environmentId !== configuredId) {
    throw new Error("The EAS project differs from the project configured for SUTRA.");
  }
  const projectId = configuredId || environmentId;
  if (!projectId) {
    return { ...config, updates: { ...config.updates, enabled: false } };
  }
  return {
    ...config,
    extra: { ...config.extra, eas: { ...config.extra?.eas, projectId } },
    updates: { ...config.updates, url: `https://u.expo.dev/${projectId}` },
  };
};
