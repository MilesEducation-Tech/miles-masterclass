import { reqHandler } from '../dist/miles-masterclass-v3/server/server.mjs';

export default async (req, res) => {
    return reqHandler(req, res);
};
