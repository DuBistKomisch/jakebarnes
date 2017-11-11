window.countdown_id = null;
window.attempts = 0;

$(document).ready(function ()
{
  $.getJSON('/pd2/data.json', function (data)
  {
    window.data = data;
    filter();
    document.location.hash = document.location.hash;
  });
  
  $('#sort').selectmenu({ width: '200px', change: update });
  $('#events').change(update);
  $('#tips').change(tips);
  $('#filterApply').button().click(filter);
  $('#filterClear').button().click(function ()
  {
    $('#filter').val('');
    filter();
  });
  
  $('#sort').val($.url().param('sort') ? $.url().param('sort') : 'rate-desc').selectmenu('refresh', true);
  $('#events').prop('checked', $.url().param('events') != undefined);
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
    get_filter('/ISteamUser/ResolveVanityURL/v0001/?key=80425AE7E1845E2B033ECA38E8F7BCBE&vanityurl=' + $('#filter').val(), 'Resolving username...', function (data)
    {
      if (data.response.steamid != undefined)
      {
        get_filter('/ISteamUserStats/GetUserStatsForGame/v0002/?appid=218620&key=80425AE7E1845E2B033ECA38E8F7BCBE&steamid=' + data.response.steamid, 'Fetching user stats...', function (data)
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
    get_filter('/ISteamUserStats/GetUserStatsForGame/v0002/?appid=218620&key=80425AE7E1845E2B033ECA38E8F7BCBE&steamid=' + $('#filter').val(), 'Fetching user stats...', function (data)
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
  
  if ($('#events').prop('checked'))
  {
    processSections(window.data, $('#achievements'), 'h1');
  }
  else
  {
    var $section = $('<section id="all"><h1><a href="#all">All</a></h1></section>');
    processAll(window.data, $section);
    $('#achievements').append($section);
  }
  
  tips();
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
  var link = window.location.protocol + '//' + window.location.hostname + window.location.pathname + '?sort=' + $('#sort').val();
  if ($('#events').prop('checked'))
    link += '&events';
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

function sortNone(a, b)
{
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

function processAll(list, base)
{
  var achievements = [];
  for (var i = 0; i < list.length; i++)
  {
    // achievements
    if (list[i].data != undefined)
      achievements = achievements.concat(list[i].data);
    // subsections
    if (list[i].children != undefined)
      for (var j = 0; j < list[i].children.length; j++)
        if (list[i].children[j].data != undefined)
          achievements = achievements.concat(list[i].children[j].data);
  }
  processAchievements(achievements, base);
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
    case 'none':
      list.sort(sortNone);
      break;
  }
  
  for (var i = 0; i < list.length; i++)
  {
    var $achievement = $('<article id="' + list[i].id + '"><div><img src="' + 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/218620/' + list[i].icon + '.jpg" alt="icon" /><h3><a href="#' + list[i].id + '">' + list[i].name + '</a></h3><p>' + list[i].description + '</p><p><span class="tag">' + list[i].rate + '</span></p></div></article>');
    // rate
    var $rate = $achievement.find('.tag');
    if (list[i].rate >= 6)
      $rate.addClass('easy');
    else if (list[i].rate >= 3)
      $rate.addClass('medium');
    else
      $rate.addClass('hard');
    // difficulty
    if (list[i].difficulty != undefined)
      $achievement.find('div:nth-of-type(1) p:nth-of-type(2)').prepend('<span class="tag difficulty ' + list[i].difficulty + '">&nbsp;</span>');
    // locks
    if (list[i].event != undefined)
      $achievement.find('div:nth-of-type(1) p:nth-of-type(2)').prepend('<span class="tag lock event">&nbsp;</span>');
    if (list[i].community != undefined)
      $achievement.find('div:nth-of-type(1) p:nth-of-type(2)').prepend('<span class="tag lock community">&nbsp;</span>');
    if (list[i].dlc != undefined)
      $achievement.find('div:nth-of-type(1) p:nth-of-type(2)').prepend('<span class="tag lock dlc">&nbsp;</span>');
    if (list[i].unlock != undefined)
      $achievement.find('div:nth-of-type(1) p:nth-of-type(2)').prepend('<span class="tag lock unlock">&nbsp;</span>');
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
      $achievement.find('div:nth-of-type(1) p:nth-of-type(1)').addClass('progress');
      if (window.user == null)
      {
        $achievement.find('div:nth-of-type(1)').append('<p><span style="display:none;"></span><span></span><span>' + list[i].max + '</span></p>');
      }
      else
      {
        var count = 0;
        $.each(window.user.stats, function (j, obj)
        {
          if (obj.name == list[i].count)
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
        if (obj.name == list[i].api)
          found = true;
      });
      if (found)
        continue;
    }
    // done
    base.append($achievement);
  }
}
