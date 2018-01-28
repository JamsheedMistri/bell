const Promise = require('bluebird')

const config = require('./config.json')
const logger = require('loggy')
const http = require('http')
const express = require('express')
const app = express()
const server = http.createServer(app)
const fs = Promise.promisifyAll(require('fs'))
const path = require('path')
const shortid = require('shortid')
const request = Promise.promisifyAll(require('request'))
const crypto = require('crypto')
const timesyncServer = require('timesync/server')

const analyticsHandler = config.postgres.enabled ? require('./PostgresAnalyticsHandler') : require('./SqliteAnalyticsHandler')

var previousCheck = 0
var cache = function (time, f) {
  // takes a function and caches its result
  // for a set number of seconds

  previousCheck = 0
  var cache = {}

  return function () {
    if (Date.now() - previousCheck > 1000 * time) { cache = {} }

    var argumentString = JSON.stringify(arguments)

    if (!cache[argumentString]) {
      previousCheck = Date.now()
      cache[argumentString] = f.apply(null, arguments)
    }

    return cache[argumentString]
  }
}

var currentVersion
var getVersion = cache(60, function () {
  var hash = crypto.createHash('md5')
  currentVersion = hash.update(fs.readFileSync('data/version.txt').toString()).digest('hex')
  return currentVersion
})
var getMessage = cache(60, function () {
  return JSON.parse(fs.readFileSync(`./data/message.json`).toString())
})

var fetch = async function (source, file) {
  var sourceData = await getSource(source)
  var res
  switch (sourceData.location) {
    case 'local':
      res = await fs.readFileAsync(`data/${source}/${file}`)
      return res.toString()
    case 'web':
      res = await request.getAsync(`${sourceData.url}/api/data/${source}/${file.split('.')[0]}`)
      return res.body
    case 'github':
      var pieces = sourceData.repo.split('/')
      var usernameRepo = pieces.slice(0, 2).join('/')
      var path = pieces.slice(2).join('/')
      res = await request.getAsync(`https://raw.githubusercontent.com/${usernameRepo}/master/${path}/${file}`)
      return res.body
  }
}
var getCorrection = cache(60, async function (source) {
  return fetch(source, 'correction.txt')
})
var getSchedules = cache(60, async function (source) {
  return fetch(source, 'schedules.bell')
})
var getCalendar = cache(60, async function (source) {
  return fetch(source, 'calendar.bell')
})
var getMeta = cache(60, async function (source) {
  var meta = await fetch(source, 'meta.json')
  return JSON.parse(meta)
})
var getSource = cache(60, async function (source) {
        // if (source.substring(0, 3) == 'gh:') {
        //     return {
        //         location: 'github',
        //         repo: source.substring(3).split(':').join('/')
        //     };
        // }
  source = await fs.readFileAsync(`data/${source}/source.json`)
  return JSON.parse(source.toString())
})

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'index.html'))
})
app.get('/offline', (req, res) => {
  res.sendFile(path.join(__dirname, 'html', 'offline.html'))
})
app.get('/m', (req, res) => {
  res.render('client-mithril', {
    version: getVersion(),
    server: config['server name']
  })
})
app.get('/periods', (req, res) => {
  res.render('periods')
})
app.get('/classes', (req, res) => {
  res.render('classes')
})
app.get('/enter', (req, res) => {
  res.render('enter')
})
app.get('/settings', (req, res) => {
  res.render('settings')
})
app.get('/blog', (req, res) => {
  res.render('blog')
})
app.get('/bin/service-worker.js', (req, res) => {
  res.set('Service-Worker-Allowed', '/')
  res.set('Cache-Control', 'no-cache, public')
  res.sendFile(path.join(__dirname, 'bin', 'service-worker.js'))
})
app.get('/xt', (req, res) => {
  res.redirect('https://chrome.google.com/webstore/detail/belllahsclub-extension/pkeeekfbjjpdkbijkjfljamglegfaikc')
})
app.get('/extension', (req, res) => {
  res.redirect('https://chrome.google.com/webstore/detail/belllahsclub-extension/pkeeekfbjjpdkbijkjfljamglegfaikc')
})
app.get('/gh', (req, res) => {
  res.redirect('https://github.com/nicolaschan/bell')
})

    // if (config['enable redis'])
app.get('/stats', (req, res) => {
  res.render('stats', {
    version: getVersion()
  })
})
app.get('/api/stats', async(req, res) => {
  res.json({
    totalHits: (await analyticsHandler.getTotalDailyHits()).rows,
    uniqueHits: (await analyticsHandler.getUniqueDailyHits()).rows,
    browserStats: (await analyticsHandler.getBrowserStats()).rows,
    osStats: (await analyticsHandler.getOSStats()).rows,
    deviceStats: (await analyticsHandler.getDeviceStats()).rows,
    themeStats: (await analyticsHandler.getThemeStats()).rows,
    sourceStats: (await analyticsHandler.getSourceStats()).rows
  })
})

app.get('/api/sources', async(req, res) => {
  var directories = fs.readdirSync('data').filter(name => fs.lstatSync(path.join('data', name)).isDirectory())

  var sources = []
  for (let directory of directories) {
    var source = await getMeta(directory)
    source.id = directory
    sources.push(source)
  }

  res.json(sources)
})
app.get('/api/sources/names', async(req, res) => {
  var directories = fs.readdirSync('data').filter(name => fs.lstatSync(path.join('data', name)).isDirectory())
  res.json(directories)
})

app.get('/api/data/:source/meta', (req, res) => {
  getMeta(req.params.source).then(meta => res.json(meta))
})
app.get('/api/data/:source/correction', (req, res) => {
  res.set('Content-Type', 'text/plain')
  getCorrection(req.params.source).then(correction => res.send(correction ? correction.toString() : '0'))
})
app.get('/api/data/:source/calendar', (req, res) => {
  res.set('Content-Type', 'text/plain')
  getCalendar(req.params.source).then(calendar => res.send(calendar))
})
app.get('/api/data/:source/schedules', (req, res) => {
  res.set('Content-Type', 'text/plain')
  getSchedules(req.params.source).then(schedules => res.send(schedules))
})
app.get('/api/version', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.send(getVersion())
})
app.get('/api/message', (req, res) => {
  res.json(getMessage())
})
app.get('/api/uuid', (req, res) => {
  res.set('Content-Type', 'text/json')
  res.send({
    id: shortid.generate()
  })
})
app.get('/api/time', (req, res) => {
  res.json({
    time: Date.now()
  })
})

var bodyParser = require('body-parser')
app.use(bodyParser.json()) // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
  extended: true
}))
app.set('view engine', 'pug')
app.use('/timesync', timesyncServer.requestHandler)

app.post('/api/analytics', async(req, res) => {
  await analyticsHandler.recordHit({
    id: req.body.id,
    userAgent: req.body.userAgent,
    theme: req.body.theme,
    source: req.body.source,
    // https://stackoverflow.com/a/10849772/
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  })
  return res.json({ success: true })
})
app.post('/api/errors', async(req, res) => {
  await analyticsHandler.recordError({
    id: req.body.id,
    userAgent: req.body.userAgent,
    theme: req.body.theme,
    source: req.body.source,
    error: JSON.stringify(req.body.error),
    // https://stackoverflow.com/a/10849772/
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  })
  return res.json({ success: true })
})
app.get('/api/themes', (req, res) => {
  res.set('Content-Type', 'text/json')
  res.sendFile(path.join(__dirname, 'data', 'themes.json'))
})
app.get('/css/selectize.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'selectize', 'dist', 'css', 'selectize.default.css'))
})

app.use('/favicons', express.static('favicons'))
app.use('/bin', express.static('bin'))
app.use('/css', express.static('css'))
app.use('/img', express.static('img'))
app.use('/icons', express.static('node_modules/material-design-icons', {
  maxage: '24h'
}))
app.use('/fonts', express.static('node_modules/roboto-fontface/fonts', {
  maxage: '24h'
}))

var startWebServer = function () {
  return new Promise((resolve, reject) => {
    server.listen(config.port, err => {
      if (err) { return reject(err) }
      logger.success('Web server listening on *:' + config.port)
      return resolve()
    })
  })
}

analyticsHandler.initialize()
  .then(startWebServer)
  .then(() => logger.success('Ready'))
