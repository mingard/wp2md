var xml2js = require('xml2js')
var fs = require('fs')
var path = require('path')
var util = require('util')
var mkdirp = require('mkdirp')
var TurndownService = require('turndown') // for Node.js
var turndownService = new TurndownService()
var http = require('http')

module.exports = function (args, callback) {
  return processExport(args[0], args[1]).then(() => {
    callback(0)
  })
}

function processExport (inputFile, outputPath) {
  return new Promise((resolve, reject) => {
    var parser = new xml2js.Parser()
    fs.readFile(inputFile, function (err, data) {
      if (err) {
        console.log('Error: ' + err)
      }

      parser.parseString(data, function (err, result) {
        if (err) {
          console.log('Error parsing xml: ' + err)
        }

        console.log('Parsed XML')

        var posts = result.rss.channel[0].item

        for (var i = 0; i < posts.length; i++) {
          processPost(posts[i], outputPath)
        }
      })
    })
  })
}

function processPost (post, outputPath) {
  var postTitle = post.title
  console.log('Processing Post:', postTitle)
  var postDate = new Date(post.pubDate)
  // console.log('Post Date: ' + postDate)
  var postData = post['content:encoded'][0]
  // console.log('Post length: ' + postData.length + ' bytes')
  var slug = post['wp:post_name'][0] === '' ? 'index' : post['wp:post_name'][0]
  // console.log('Post slug: ' + slug)

  // Merge categories and tags into tags
  var categories = []
  if (post.category != undefined) {
    for (var i = 0; i < post.category.length; i++) {
      var cat = post.category[i]['_']
      if (cat != 'Uncategorized') { categories.push(cat) }
      // console.log('CATEGORY: ' + util.inspect(post.category[i]['_']));
    }
  }

  var fullPath = path.join(outputPath, postDate.getFullYear().toString(), getPaddedMonthNumber(postDate.getMonth() + 1))  // 'out\\' + postDate.getFullYear() + '\\' + getPaddedMonthNumber(postDate.getMonth() + 1) + '\\' + slug

  mkdirp(fullPath, (err, made) => {
    // Find all images
    var patt = new RegExp('(?:src="(.*?)")', 'gi')

    var m
    var matches = []

    while ((m = patt.exec(postData)) !== null) {
      matches.push(m[1])
    }

    if (matches != null && matches.length > 0) {
      for (var i = 0; i < matches.length; i++) {
        var url = matches[i]
        var urlParts = matches[i].split('/')
        var imageName = urlParts[urlParts.length - 1]

        var filePath = path.join(fullPath, imageName)

        downloadFile(url, filePath)

        // Make the image name local relative in the markdown
        postData = postData.replace(url, imageName)
      }
    }

    var markdown = turndownService.turndown(postData, { gfm: true })

    // Fix characters that markdown doesn't like
    // smart single quotes and apostrophe
    markdown = markdown.replace(/[\u2018|\u2019|\u201A]/g, "\'")

    // smart double quotes
    markdown = markdown.replace(/&quot;/g, '"')
    markdown = markdown.replace(/[\u201C|\u201D|\u201E]/g, '"')

    // ellipsis
    markdown = markdown.replace(/\u2026/g, '...')

    // dashes
    markdown = markdown.replace(/[\u2013|\u2014]/g, '-')

    // circumflex
    markdown = markdown.replace(/\u02C6/g, '^')

    // open angle bracket
    markdown = markdown.replace(/\u2039/g, '<')
    markdown = markdown.replace(/&lt;/g, '<')

    // close angle bracket
    markdown = markdown.replace(/\u203A/g, '>')
    markdown = markdown.replace(/&gt;/g, '>')

    // spaces
    markdown = markdown.replace(/[\u02DC|\u00A0]/g, ' ')

    // ampersand
    markdown = markdown.replace(/&amp;/g, '&')

    var header = ''
    header += '---\n'
    header += 'layout: post\n'
    header += 'slug: ' + slug + '\n'
    header += 'title: ' + postTitle + '\n'
    header += 'date: ' + postDate.getFullYear() + '-' + getPaddedMonthNumber(postDate.getMonth() + 1) + '-' + getPaddedDayNumber(postDate.getDate()) + '\n'
    if (categories.length > 0) { header += 'tags: ' + JSON.stringify(categories) + '\n' }
    header += '---\n'
    header += '\n'

    fs.writeFileSync(path.join(fullPath, slug) + '.md', header + markdown)
  })
}

function downloadFile (url, path) {
  console.log('Attempt downloading ' + url + ' to ' + path + ' ' + url.indexOf('https:'))
  if (url.indexOf('https:') == -1) {
    if (url.indexOf('.jpg') >= 0 || url.indexOf('.png') >= 0 || url.indexOf('.png') >= 0) {
      var file = fs.createWriteStream(path).on('open', function () {
        var request = http.get(url, function (response) {
          console.log('Response code: ' + response.statusCode)
          response.pipe(file)
        }).on('error', function (err) {
          console.log('error downloading url: ' + url + ' to ' + path)
        })
      }).on('error', function (err) {
        console.log('error downloading url2: ' + url + ' to ' + path)
      })
    } else {
      console.log('passing on: ' + url + ' ' + url.indexOf('https:'))
    }
  } else {
    console.log('passing on: ' + url + ' ' + url.indexOf('https:'))
  }
}

function getPaddedMonthNumber (month) {
  if (month < 10) {
    return '0' + month
  } else {
    return '' + month
  }
}

function getPaddedDayNumber (day) {
  if (day < 10) {
    return '0' + day
  } else {
    return '' + day
  }
}
