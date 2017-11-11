var fs = require('fs');
var http = require('http');

var DATA_FILE = '../public/kf/data.json';
var MAPS_FILE = '../public/kf/maps.json';

http.get({host: 'api.steampowered.com', path: '/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=1250&format=json'}, function (res) {
  var response = '';
  res.on('data', function (chunk) {
    response += chunk;
    process.stdout.write('downloading ' + Math.round(response.length / res.headers['content-length'] * 100) + '%\r');
  }).on('end', function () {
    console.log();
    go(response);
  });
}).on('error', function (e) {
  console.log('error: ' + e.message);
});

function go(response)
{
  // get steam data
  var tree = JSON.parse(response);
  var main = tree.achievementpercentages.achievements;
  console.log('found ' + main.length);

  // get existing json
  var data = JSON.parse(fs.readFileSync(DATA_FILE, {encoding: 'utf8'}));
  var maps = JSON.parse(fs.readFileSync(MAPS_FILE, {encoding: 'utf8'}));

  // start DATA
  console.log('-- working on ' + DATA_FILE);

  // init counters
  var matched = 0;
  var updated = 0;

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
  }

  // done DATA
  console.log('matched ' + matched);
  console.log('updated ' + updated);

  // start MAPS
  console.log('-- working on ' + MAPS_FILE);

  // init counters
  var matched = 0;
  var updated = 0;

  for (var i = 0; i < main.length; ++i)
  {
    // match to existing json node
    for (var j = 0; j < maps.length; ++j)
    {
      for (var k = 0; k < maps[j].data.length; ++k)
      {
        var map = maps[j].data[k];
        for (var l = 0; l < 4; ++l)
        {
          var name = Array.isArray(map.api) ? map.api[l] : 'win' + map.api + ['normal', 'hard', 'suicidal', 'hell'][l];
          if (main[i].name.toLowerCase() == name)
          {
            // update
            ++matched;
            rate = String(main[i].percent);
            rate = Number(rate.substring(0, rate.indexOf('.') + 3));
            if (map.rate[l] != rate)
            {
              ++updated;
              map.rate[l] = rate;
            }
          }
        }
      }
    }
  }

  // done MAPS
  console.log('matched ' + matched);
  console.log('updated ' + updated);

  // write json
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  fs.writeFileSync(MAPS_FILE, JSON.stringify(maps, null, 2));
}

function findAchievement(list, name)
{
  name = name.toLowerCase();
  for (var i = 0; i < list.length; ++i)
    if (list[i].api == name)
      return list[i];
  return undefined;
}
