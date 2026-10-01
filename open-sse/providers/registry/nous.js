import { NOUS_CHAT_COMPLETIONS_URL } from "../../services/nous.js";

// Static-key-only provider. This intentionally does not model Hermes Portal OAuth,
const nous = {
  id: "nous",
  priority: 65,
  alias: "nous",
  aliases: ["nous-portal", "nous-research"],
  display: {
    name: "Nous Portal",
    icon: "psychology",
    color: "#111827",
    textIcon: "NR",
    website: "https://nousresearch.com",
    notice: {
      text: "Connect a user-created Nous Portal API key. The Portal catalog is discovered from your connected account.",
      apiKeyUrl: "https://portal.nousresearch.com/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: NOUS_CHAT_COMPLETIONS_URL,
  },
  // Canonical upstream IDs, not router-qualified IDs. Dynamic entries arrive as
  // nous/<upstream-id> with upstreamModelId for slash-safe routing.
  models: [
    { id: "nousresearch/hermes-4-70b", name: "Hermes 4 70B" },
    { id: "nousresearch/hermes-4-405b", name: "Hermes 4 405B" },
  ],
  serviceKinds: ["llm"],
  passthroughModels: true,
};

export default nous;
