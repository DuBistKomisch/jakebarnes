window.tableSortMode = {};
window.countdown_id = null;
window.attempts = 0;

$(document).ready(function ()
{
  $.getJSON('/kf2/data.json', function (data)
  {
    window.data = data;

    $.getJSON('/kf2/tables.json', function (data)
    {
      window.tables = data;
      filter();
      document.location.hash = document.location.hash;
    });
  });

  $('#sort').selectmenu({ width: '200px', change: update });
  $('#group').selectmenu({ width: '200px', change: update });
  $('#tips').change(tips);
  $('#filterApply').button().click(filter);
  $('#filterClear').button().click(function ()
  {
    $('#filter').val('');
    filter();
  });

  $('#sort').val($.url().param('sort') ? $.url().param('sort') : 'rate-desc').selectmenu('refresh', true);
  $('#group').val($.url().param('group') ? $.url().param('group') : 'none').selectmenu('refresh', true);
  $('#tips').prop('checked', $.url().param('tips') != undefined);
  $('#filter').val($.url().param('filter') ? $.url().param('filter') : '');

  $('#filter').addClass('ui-widget ui-corner-all');
  $('#filter').tooltip({
    position: { my: "left+10 bottom-10", at: "left top" },
    content: '<p>Open your Steam profile and copy the last part of the URL.</p><p>steamcommunity.com/id/<span style="font-weight: bold;">dubistkomisch</span></p><p>steamcommunity.com/profiles/<span style="font-weight: bold;">76561198030777165</span></p><p style="color:red;font-style:italic;">Your profile must be public.</p>'
  });
});

function filter()
{
  // reset retry
  if (window.countdown_id != null)
  {
    clearInterval(window.countdown_id);
    window.countdown_id = null;
  }
  window.attempts = 3;

  $('#filter').val($('#filter').val().trim());

  if ($('#filter').val() == '')
  {
    filter_status('success', '');
    window.user = null;
    update();
    return;
  }

  if (isNaN(Number($('#filter').val())))
  {
    // not a number, assume username and resolve to SteamID64
    get_filter('/steam/resolve?vanityurl=' + $('#filter').val(), 'Resolving username...', function (data)
    {
      if (data.response.steamid != undefined)
      {
        get_filter('/steam/stats?appid=232090&steamid=' + data.response.steamid, 'Fetching user stats...', function (data)
        {
          if (data.playerstats != undefined)
          {
            filter_status('success', 'Done.');
            window.user = data.playerstats;
            update();
          }
          else
          {
            filter_status('error', 'Not a valid SteamID64.');
            window.user = null;
            update();
          }
        });
      }
      else
      {
        filter_status('error', 'Not a valid username.');
        window.user = null;
        update();
      }
    });
  }
  else
  {
    // number, assume SteamID64
    get_filter('/steam/stats?appid=232090&steamid=' + $('#filter').val(), 'Fetching user stats...', function (data)
    {
      if (data.playerstats != undefined)
      {
        filter_status('success', 'Done.');
        window.user = data.playerstats;
        update();
      }
      else
      {
        filter_status('error', 'Not a valid SteamID64.');
        window.user = null;
        update();
      }
    });
  }
}

function get_filter(url, working, success)
{
  filter_status('working', working);
  $.get(url)
  .done(function (data, statusText, jqXHR)
  {
    success(data);
  })
  .fail(function (jqXHR, statusText, error)
  {
    if (--window.attempts > 0)
    {
      var counter = 20;
      filter_status('error', 'Steam is busy! Trying again in ' + counter + '...');
      window.countdown_id = setInterval(function ()
      {
        if (--counter == 0)
        {
          clearInterval(window.countdown_id);
          window.countdown_id = null;
          get_filter(url, working, success);
        }
        else
        {
          filter_status('error', 'Steam is busy! Trying again in ' + counter + '...');
        }
      }, 1000);
    }
    else
    {
      filter_status('error', 'Steam is busy! Try again later.');
    }
  });
}

function filter_status(type, message)
{
  $('#filterStatus').removeClass().addClass(type).text(message);
}

function update()
{
  $('#achievements').empty();

  switch ($('#group').val())
  {
    case 'none':
      var $section = $('<section id="all"><h1><a href="#all">All</a></h1></section>');
      var achievements = [];
      for (var i = 0; i < window.data.length; i++)
      {
        // achievements
        if (window.data[i].data != undefined)
          achievements = achievements.concat(window.data[i].data);
        // subsections
        if (window.data[i].children != undefined)
          for (var j = 0; j < window.data[i].children.length; j++)
            if (window.data[i].children[j].data != undefined)
              achievements = achievements.concat(window.data[i].children[j].data);
      }
      processAchievements(achievements, $section);
      $('#achievements').append($section);
      break;
    case 'event':
      processSections(window.data, $('#achievements'), 'h1');
      break;
    case 'perk':
      var perks = ['medic', 'support', 'sharpshooter', 'commando', 'berserker', 'firebug', 'demolition', 'none'];
      var achievements = {};
      for (var i = 0; i < perks.length; i++)
        achievements[perks[i]] = [];
      for (var i = 0; i < window.data.length; i++)
      {
        // achievements
        if (window.data[i].data != undefined)
          for (var k = 0; k < window.data[i].data.length; k++)
          {
            var record = window.data[i].data[k];
            achievements[record.perk != undefined ? record.perk : 'none'].push(record);
          }
        // subsections
        if (window.data[i].children != undefined)
          for (var j = 0; j < window.data[i].children.length; j++)
            if (window.data[i].children[j].data != undefined)
              for (var k = 0; k < window.data[i].children[j].data.length; k++)
              {
                var record = window.data[i].children[j].data[k];
                achievements[record.perk != undefined ? record.perk : 'none'].push(record);
              }
      }
      for (var i = 0; i < perks.length; i++)
      {
        var $section = $('<section id="' + perks[i] + '"><h1><a href="#' + perks[i] + '">' + perks[i].charAt(0).toUpperCase() + perks[i].substr(1) + '</a></h1></section>');
        processAchievements(achievements[perks[i]], $section);
        if ($section.children().length > 1)
          $('#achievements').append($section);
      }
      break;
  }

  tips();

  update_tables();
}

function tips()
{
  if ($('#tips').prop('checked'))
  {
    $('article.tips').css('padding-bottom', '10px');
    $('article > p').css('display', 'block');
  }
  else
  {
    $('article.tips').css('padding-bottom', '0px');
    $('article > p').css('display', 'none');
  }

  // only place reached when changing any option
  var link = window.location.protocol + '//' + window.location.hostname + window.location.pathname + '?sort=' + $('#sort').val() + '&group=' + $('#group').val();
  if ($('#tips').prop('checked'))
    link += '&tips';
  if ($('#filter').val() != '')
    link += '&filter=' + $('#filter').val();
  $('#bookmark').prop('href', link);
}

function sortRateDesc(a, b)
{
  if (a.rate < b.rate)
    return 1;
  else if (a.rate > b.rate)
    return -1;
  return 0;
}

function sortRateAsc(a, b)
{
  if (a.rate < b.rate)
    return -1;
  else if (a.rate > b.rate)
    return 1;
  return 0;
}

function sortName(a, b)
{
  if (a.name < b.name)
    return -1;
  else if (a.name > b.name)
    return 1;
  return 0;
}

function processSections(list, base, level)
{
  for (var i = 0; i < list.length; i++)
  {
    var $section = $('<section id="' + list[i].id + '"><' + level + '><a href="#' + list[i].id + '">' + list[i].name + '</a></h1></section>');
    // achievements
    if (list[i].data != undefined)
      processAchievements(list[i].data, $section);
    // subsections
    if (list[i].children != undefined)
      processSections(list[i].children, $section, 'h2');
    // done
    if ($section.children().length > 1)
      base.append($section);
  }
}

function processAchievements(list, base)
{
  switch ($('#sort').val())
  {
    case 'rate-desc':
      list.sort(sortRateDesc);
      break;
    case 'rate-asc':
      list.sort(sortRateAsc);
      break;
    case 'name':
      list.sort(sortName);
      break;
  }

  for (var i = 0; i < list.length; i++)
  {
    var $achievement = $('<article id="' + list[i].id + '"><div><img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/232090/' + list[i].icon + '.jpg" alt="icon" /><h3><a href="#' + list[i].id + '">' + list[i].name + '</a></h3><p>' + list[i].description + '</p><p><span class="tag">' + list[i].rate + '</span></p></div></article>');
    // perk
    if (list[i].perk != undefined)
      $achievement.find('div:nth-of-type(1)').addClass(list[i].perk);
    // rate
    var $rate = $achievement.find('.tag');
    if (list[i].rate >= 6)
      $rate.addClass('easy');
    else if (list[i].rate >= 3)
      $rate.addClass('medium');
    else
      $rate.addClass('hard');
    // event
    if (list[i].event != undefined)
      $achievement.find('div:nth-of-type(1) p:nth-of-type(2)').prepend('<span class="tag event">&nbsp;</span>');
    // link
    if (list[i].link) {
      $achievement.find('div:nth-of-type(1) p:nth-of-type(2)').prepend('<span class="tag link"><a href="' + list[i].link + '">&#x1f517;</a></span>');
    }
    // tips
    if (list[i].tips != undefined)
    {
      for (var j = 0; j < list[i].tips.length; j++)
        $achievement.append('<p>' + list[i].tips[j] + '</p>');
      if (list[i].tips.length > 0)
        $achievement.addClass('tips');
    }
    // progress
    if (list[i].max != undefined)
    {
      if (window.user == null)
      {
        $achievement.find('div:nth-of-type(1)').append('<p><span style="display:none;"></span><span></span><span>' + list[i].max + '</span></p>');
      }
      else
      {
        var count = 0;
        $.each(window.user.stats, function (j, obj)
        {
          if (obj.name.toLowerCase() == list[i].count)
            count = obj.value;
        });
        $achievement.find('div:nth-of-type(1)').append('<p><span style="width:' + Math.min(100, Math.round(count / list[i].max * 100)) + 'px;"></span><span>' + count + '</span><span>' + list[i].max + '</span></p>');
      }
    }
    // filter
    if (window.user != null)
    {
      var found = false;
      $.each(window.user.achievements, function (j, obj)
      {
        if (obj.name.toLowerCase() == list[i].api)
          found = true;
      });
      if (found)
        continue;
    }
    // done
    base.append($achievement);
  }
}

function update_tables()
{
  var $base = $("#tables");
  $base.empty();

  window.tables.forEach(function (table) {
    var $section = $('<section id="' + table.id + '"><h1><a href="#' + table.id + '">' + table.name + '</a></h1></section>');

    // construct new table
    var headings = '';
    table.columns.forEach(function (column, index) {
      headings += '<th><a href="javascript:sort_table(\'' + table.id + '\', \'' + index + '\');">' + column + '</a></th>';
    });
    var $table = $('<table><thead><tr>' + headings + '</tr></thead></table>');
    var $tbody = $('<tbody></tbody>');

    // sort list as desired
    var list = table.data;
    var sort_column = tableSortMode[table.id];
    if (sort_column == 0) {
      list.sort(sort_table_name);
    } else if (sort_column > 0) {
      list.sort(function (a, b) {
        return sort_table_rate(a, b, sort_column - 1);
      });
    }

    // create rows
    for (var i = 0; i < list.length; i++) {
      var $row = $('<tr id="' + list[i].id + '"><td class="first"><a href="#' + list[i].id + '">' + list[i].name + '</a></td></tr>');
      for (var j = 0; j < table.columns.length - 1; j++) {
        $td = $('<td></td>');
        if (list[i].api[j]) {
          if (window.user != null) {
            var found = false;
            $.each(window.user.achievements, function (k, obj) {
              if (obj.name.toLowerCase() == list[i].api[j])
                found = true;
            });
          }
          if (found) {
            $td.append('&#x2714;');
          } else {
            if (list[i].link[j]) {
              $td.append('<span class="tag link"><a href="' + list[i].link[j] + '">&#x1f517;</a></span>');
            }
            $td.append($('<span class="tag ' + (list[i].rate[j] >= 4 ? 'easy' : (list[i].rate[j] >= 2 ? 'medium' : 'hard')) + '">' + list[i].rate[j] + '</span>'));
          }
        } else {
          $td.append('&nbsp;');
        }
        $row.append($td);
      }
      $tbody.append($row);
    }

    // put everything together
    $table.append($tbody);
    $section.append($table);
    $base.append($section);
  });
}

function sort_table(table, column) {
  tableSortMode[table] = column;
  update_tables();
}

function sort_table_name(a, b)
{
  if (a.name < b.name)
    return -1;
  else if (a.name > b.name)
    return 1;
  return 0;
}

function sort_table_rate(a, b, i)
{
  if (a.rate[i] < b.rate[i])
    return 1;
  else if (a.rate[i] > b.rate[i])
    return -1;
  return 0;
}
