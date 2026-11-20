const configure = require("../app.config");

function verifyProject(input) {
  const config = configure({ config: input });
  if (!config.extra?.eas?.projectId || config.updates?.enabled === false) {
    throw new Error("Configure the SUTRA project's EAS_PROJECT_ID before building or publishing.");
  }
}

if (require.main === module) verifyProject(require("../app.json").expo);
module.exports = { verifyProject };
