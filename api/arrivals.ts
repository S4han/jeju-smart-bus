// Vercel Function 진입점 (TASK-004). 로직은 api/ 밖의 server/에 둔다.
import { handleArrivalsRequest } from "../server/arrivals.js";

export default { fetch: handleArrivalsRequest };
