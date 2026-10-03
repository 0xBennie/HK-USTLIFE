import {createProductWeb,environmentWebConfig} from '../../../../lib/product-web';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request){try{return await createProductWeb(environmentWebConfig())(request);}catch{return Response.json({error:{code:'WEB_CONFIGURATION',message:'Local web configuration is invalid.'}},{status:503,headers:{'Cache-Control':'no-store'}});}}
export const GET=handle;
export const POST=handle;
