var fs = require('fs');
var http = require('http');
var xml2json = require('xml2json');
var slug = require('slug');

var DATA_FILE = '../public/pd2/data.json';
var global = null;
var meta = null;

http.get({host: 'api.steampowered.com', path: '/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=218620&format=json'}, function (res) {
  var response = '';
  res.on('data', function (chunk) {
    response += chunk;
    process.stdout.write('[stat] downloading ' + Math.round(response.length / res.headers['content-length'] * 100) + '%\r');
  }).on('end', function () {
    console.log();
    global = response;
    http.get({host: 'steamcommunity.com', path: '/id/dubistkomisch/stats/PAYDAY2?tab=achievements&xml=1'}, function (res) {
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

  // start DATA
  console.log('-- working on ' + DATA_FILE);

  // init counters
  var added = 0;
  var matched = 0;
  var updated = 0;
  var unmatched = [];
  var newSection = null;

  // add missing
  meta: for (var i = 0; i < mainMeta.length; ++i)
  {
    for (var j = 0; j < data.length; ++j)
      if (findAchievement(data[j].data, mainMeta[i].apiname) != null)
        continue meta;
    if (newSection == null)
      data.push(newSection = {'id': 'test', 'name': 'Test', 'data': []});
    var node = {
      'id': slug(mainMeta[i].name).toLowerCase(),
      'api': mainMeta[i].apiname,
      'icon': mainMeta[i].iconClosed.substr(75, 40),
      'name': mainMeta[i].name,
      'description': mainMeta[i].description,
      'rate': 0.0
    };
    newSection.data.push(node);
    added++;
  }

  // update rates
  for (var i = 0; i < main.length; ++i)
  {
    // match to existing json node
    var node = undefined;
    for (var j = 0; j < data.length; ++j)
    {
      node = findAchievement(data[j].data, main[i].name);
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
    else
    {
      unmatched.push(main[i].name);
    }
  }

  // done DATA
  console.log('added: ' + added);
  console.log('unmatched: ' + unmatched);
  console.log('matched: ' + matched);
  console.log('updated: ' + updated);

  // write json
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function findAchievement(list, name)
{
  name = name.toLowerCase();
  for (var i = 0; i < list.length; ++i)
    if (list[i].api == name)
      return list[i];
  return undefined;
}
