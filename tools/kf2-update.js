var fs = require('fs');
var https = require('https');
var xml2json = require('xml2json');
var slug = require('slug');

var DATA_FILE = '../public/kf2/data.json';
var TABLES_FILE = '../public/kf2/tables.json';

var global = null;
var meta = null;

https.get('https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=232090&format=json', function (res) {
  var response = '';
  res.on('data', function (chunk) {
    response += chunk;
    process.stdout.write('[stat] downloading ' + Math.round(response.length / res.headers['content-length'] * 100) + '%\r');
  }).on('end', function () {
    console.log();
    global = response;
    https.get('https://steamcommunity.com/id/dubistkomisch/stats/appid/232090/achievements?xml=1', function (res) {
      var response = '';
      res.on('data', function (chunk) {
        response += chunk;
        process.stdout.write('[meta] downloading ' + Math.round(response.length / res.headers['content-length'] * 100) + '%\r');
      }).on('end', function () {
        console.log();
        meta = response;
        go();
      });
    }).on('error', function (e) {
      console.log('error: ' + e.message);
    });
  });
}).on('error', function (e) {
  console.log('error: ' + e.message);
});

function go()
{
  // get steam data
  var tree = JSON.parse(global);
  var main = tree.achievementpercentages.achievements;
  console.log('[stat] found ' + main.length);
  var treeMeta = JSON.parse(xml2json.toJson(meta));
  var mainMeta = treeMeta.playerstats.achievements.achievement;
  console.log('[meta] found ' + mainMeta.length);

  // get existing json
  var data = JSON.parse(fs.readFileSync(DATA_FILE, {encoding: 'utf8'}));
  var tables = JSON.parse(fs.readFileSync(TABLES_FILE, {encoding: 'utf8'}));

  // init counters
  var added = 0;
  var newSection = null;
  var unmatched = [];
  var matched = 0;
  var updated = 0;

  // add missing
  meta: for (var i = 0; i < mainMeta.length; ++i)
  {
    for (var j = 0; j < data.length; ++j)
      if (findAchievement(data[j].data, mainMeta[i].apiname) != null)
        continue meta;
    if (existsTable(tables, mainMeta[i].apiname))
      continue meta;
    if (newSection == null)
      data.push(newSection = {'id': 'test', 'name': 'Test', 'data': []});
    var node = {
      'id': slug(mainMeta[i].name).toLowerCase(),
      'api': mainMeta[i].apiname,
      'icon': mainMeta[i].iconClosed.substr(73, 40),
      'name': mainMeta[i].name,
      'description': mainMeta[i].description,
      'rate': 0.0
    };
    newSection.data.push(node);
    added++;
  }

  console.log('-- checks');
  console.log('added: ' + added);

  // start DATA
  for (var i = 0; i < main.length; ++i)
  {
    // match to existing json node
    var node = undefined;
    for (var j = 0; j < data.length; ++j)
    {
      if (data[j].children == undefined)
        node = findAchievement(data[j].data, main[i].name);
      else for (var k = 0; k < data[j].children.length; ++k)
      {
        node = findAchievement(data[j].children[k].data, main[i].name);
        if (node != undefined)
          break;
      }
      if (node != undefined)
        break;
    }

    // update
    if (node != undefined)
    {
      ++matched;
      rate = String(main[i].percent);
      rate = Number(rate.substring(0, rate.indexOf('.') + 3));
      if (node.rate != rate)
      {
        ++updated;
        node.rate = rate;
      }
    }
    else if (!existsTable(tables, main[i].name))
    {
      unmatched.push(main[i].name);
    }
  }

  // done DATA
  console.log('unmatched: ' + unmatched.length + ' [' + unmatched + ']');
  console.log('-- ' + DATA_FILE);
  console.log('matched: ' + matched);
  console.log('updated: ' + updated);

  // reset counters
  matched = 0;
  updated = 0;

  // start TABLES
  for (var i = 0; i < main.length; ++i)
  {
    // match to existing json node
    for (var j = 0; j < tables.length; ++j)
    {
      for (var k = 0; k < tables[j].data.length; ++k)
      {
        for (var l = 0; l < 5; ++l)
        {
          if (main[i].name.toLowerCase() == tables[j].data[k].api[l])
          {
            // update
            ++matched;
            rate = String(main[i].percent);
            rate = Number(rate.substring(0, rate.indexOf('.') + 3));
            if (tables[j].data[k].rate[l] != rate)
            {
              ++updated;
              tables[j].data[k].rate[l] = rate;
            }
          }
        }
      }
    }
  }

  // done TABLES
  console.log('-- ' + TABLES_FILE);
  console.log('matched: ' + matched);
  console.log('updated: ' + updated);

  // write json
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  fs.writeFileSync(TABLES_FILE, JSON.stringify(tables, null, 2));
}

function findAchievement(list, name)
{
  name = name.toLowerCase();
  for (var i = 0; i < list.length; ++i)
    if (list[i].api == name)
      return list[i];
  return undefined;
}

function existsTable(list, name)
{
  name = name.toLowerCase();
  for (var i = 0; i < list.length; ++i)
    for (var j = 0; j < list[i].data.length; ++j)
      for (var k = 0; k < 5; ++k)
        if (list[i].data[j].api[k] == name)
          return true;
  return false;
}
