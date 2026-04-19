import { SetMetadata } from "@nestjs/common";

import { RAW_RESPONSE_METADATA_KEY } from "../Http/apiResponse.js";

export const RawResponse = () => SetMetadata(RAW_RESPONSE_METADATA_KEY, true);
