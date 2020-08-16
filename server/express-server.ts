// import { httpPort, httpsPort, pathToCert, pathToCertKey } from './../topsecret/.env.ts'
import {cities} from './cities'
import * as fs from 'fs-sync'
import * as path from 'path'
import * as express from 'express'
import * as compression from 'compression'

const http = require('http')
const https = require('https')
const cors = require('cors')
const shell = require('shelljs');

const configPath = path.join(path.resolve(''), './../topsecret/.env.json')
console.log(`working with config path: ${configPath}`)
export const config = fs.readJSON(configPath)

executeMasterplan()
  .then((result: any) => {

  })
  .catch((error) => console.log(error.message))

async function executeMasterplan() {
  // Masterplan
  regularlyGetTheLatestFancyShit()
  const app = express();
  app.use(cors())
  app.use(compression())
  const mainStaticAssetsPath = useStaticAssets(app)
  const html = await readPageToMainMemory(mainStaticAssetsPath)
  defineRoutes(app, html)
  // ensureRedirectingFromUnsafeHostToSaveHost()

  startListening(app)

}



// Details
async function readPageToMainMemory(pathToStaticAssets: string): Promise<string> {
  // let html = decoder.decode(await Deno.readFile(`${mainStaticAssetsPath}/i-want-compression-via-route.html`))
  return fs.read(`${pathToStaticAssets}/i-want-compression-via-route.html`)
}

function regularlyGetTheLatestFancyShit() {
  setInterval(async () => {
    const commandToBeExecuted = `./../topsecret/pull.sh`
    // const commandToBeExecuted = `ls`
    try {
      shell.exec(commandToBeExecuted)
    } catch (error) {
      console.log(error.message)
    }

  }, 2 * 60 * 1000)
}

function useStaticAssets(app): string {
  const pathToStaticAssets = path.join(path.resolve(''), './docs')
  app.use(express.static(pathToStaticAssets))
  console.log(`serving static assets from ${pathToStaticAssets}`)
  return pathToStaticAssets
}


function defineRoutes(app, html) {

  let pathToEvents = path.join(path.resolve(''), './events')
  app.get('/', (req, res) => {
    res.send(html)
  })

  app.get('/images/getEventImage/name/:name', (req: any, res: any) => {
    res.sendFile(`${pathToEvents}/${req.params.name}`);
  });

  app.get('/events/getAllEvents/key/:key', async (req: any, res: any) => {
    res.send(fs.readJSON(`${pathToEvents}/events.json`));
  });

  app.get('/cities/getCitiesWithMin/minNumberOfInhabitants/:minNumberOfInhabitants/key/:key', async (req: any, res: any) => {
    console.log(req.headers)
    // const cities = CityService.getCitiesByPopulation(Number(req.params.minNumberOfInhabitants))
    res.send(cities);
  });

  app.get('/location/getIPLocation/key/:key', async (req: any, res: any) => {
    res.send({
      name: 'Heidelberg',
      lat: 49.40768,
      lon: 8.69079,
    });
  });

  app.get('/community/getTelegramGroups/key/:key', async (req: any, res: any) => {
    res.send(fs.readJSON(`${pathToEvents}/../groups/telegram.json`));
  });
}

function startListening(app) {

  if (config.httpsPort > 0) {
    const certificate = fs.read(config.pathToCert)
    const privateKey = fs.read(config.pathToCertKey)
    const credentials = { key: privateKey, cert: certificate }
    const httpsServer = https.createServer(credentials, app)
    httpsServer.listen(config.httpsPort)
  }

  if (config.httpPort > 0) {
    const httpServer = http.createServer(app)
    httpServer.listen(config.httpPort)
    console.log(`listening on : http://localhost:${config.httpPort}`)
  }
}

// // tslint:disable-next-line: only-arrow-functions
// function ensureRedirectingFromUnsafeHostToSaveHost() {
//   const unsafePort = 80
//   const httpForwarderAPPListeningOnUnsafePort = express()

//   let forwarded = false
//   httpForwarderAPPListeningOnUnsafePort.get('*', (req, res) => {
//     if (!forwarded) {
//       forwarded = true
//       setTimeout(() => {
//         forwarded = false
//       }, 100)
//       res.send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url='https://dance-planner.org'" /></head><body><p>Redirecting to https: <a href="https://dance-planner.org">https://dance-planner.org/</a></p></body></html>`)
//     }
//   })

//   httpForwarderAPPListeningOnUnsafePort.listen(unsafePort)
// }
