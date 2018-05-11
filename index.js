const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

app.use(function (req, res, next) {
  sendError(res, 404, 'This is not valid api method. Please try /films/id/recommendations');
});

app.use(function (err, req, res, next) {
  console.error(err.stack)
  sendError(res, 500, 'Internal server error.');
})

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  const filmId = Number(req.params.id);
  const limit = req.query.limit == undefined ? 'skip' : Number(req.params.limit);
  const offset = req.query.offset == undefined ? 'skip' : Number(req.params.offset);

  if (filmId && (limit >= 0 || limit == 'skip') && (offset >= 0 || offset == 'skip')) {
    getFilmById(filmId)
      .then((f) => {
        if (f && f.dataValues) {
          const genreId = Number(f.dataValues.genre_id);         
          const releaseDate = new Date(f.dataValues.release_date);
          const fromDate = getYearsShiftDateString(releaseDate, -15);
          const toDate = getYearsShiftDateString(releaseDate, 15);

          getFilmByGenre(genreId, fromDate, toDate)
            .then((results) => {
              if (results) {

                const ids = results.map(r => r.id);
                //console.log('ids', ids);

                getReviews(ids, (idToRating) => {

                  if (!idToRating) {
                    sendError(res, 404, `Recommendations based on film with id ${filmId} were not found.`);
                    return;
                  }

                  let filtered = results.filter(r => !!idToRating && idToRating[r.id]);
                  for(let i = 0; i < filtered.length; i++) {
                    filtered[i].averageRating = precisionRound(idToRating[filtered[i].id].averageRating, 2);
                    filtered[i].reviews = idToRating[filtered[i].id].totalReviews;
                  }

                  filtered = filtered.map(f => {
                    return {
                      averageRating: f.averageRating,
                      id: f.id,
                      releaseDate: f.release_date,
                      reviews: f.reviews,
                      title: f.title
                    };
                  });

                  filtered.sort((a,b) => a.id - b.id);

                  res.json({ recommendations: filtered });
                });

              } else {
                sendError(res, 404, `Recommendations based on film with id ${filmId} were not found.`);
              }
            })
            .catch((err) => {
              sendError(res, 400, err);
            });

        } else {
          sendError(res, 404, `Film with id ${filmId} is not found.`);
        }       
      }).catch((err) => {
        sendError(res, 400, err);
      });         
  } else {
    sendError(res, 403, 'Please provide proper film id.');
  }
}

// SQL functions ==============================================================
const sequelize = new Sequelize('main', null, null, {
  dialect: 'sqlite',
  storage: DB_PATH,
});

// Define SQL models
const Films = sequelize.define('films', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true
  },
  title: Sequelize.STRING,
  release_date: Sequelize.STRING,
  tagline: Sequelize.STRING,
  revenue: Sequelize.INTEGER,
  budget: Sequelize.INTEGER,
  runtime: Sequelize.INTEGER,
  original_language: Sequelize.STRING,
  status: Sequelize.STRING,
  genre_id: Sequelize.INTEGER,
}, {
  timestamps: false
});

// === functions ==============================================================
function sendError(res, code, message) {
  console.error('ERROR: ', message);
  res.status(code).json({ message });
}

function getYearsShiftDateString(date, shift) {
  const localDate = new Date(date);
  const newDate = new Date(localDate.setFullYear(date.getFullYear() + shift));
  return newDate.toISOString().split('T')[0];
}

function precisionRound(n, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

function getFilmById(filmId) {
  return Films.findById(filmId);
}

function getFilmByGenre(genre_id, fromDate, toDate) {
  return Films.findAll({
    where: { 
      genre_id,
      release_date: {
        $lte: toDate,
        $gte: fromDate
      }
    },
    raw: true
  });
}

const API_URL = 'http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1';

function getReviews (filmIds, callback) {
  request(`${ API_URL }?films=${ filmIds.join() }`, (err, response, body) => {
    const films = JSON.parse(body);
 
    const atLeastFiveReviews = films.filter(f => f.reviews && f.reviews.length && f.reviews.length >= 5);

    const averageCalculated = atLeastFiveReviews.map(f => {
      return {
        id: f.film_id,
        averageRating: (f.reviews && f.reviews.length ? f.reviews.reduce((sum, review) => sum + parseFloat(review.rating), 0) / f.reviews.length : 0),
        totalReviews: f.reviews && f.reviews.length ? f.reviews.length : 0
      }
    });
    
    const filtered = averageCalculated.filter(f => f.averageRating > 4);

    const idToRating = {};
    filtered.map(f => idToRating[f.id] = { averageRating: f.averageRating, totalReviews: f.totalReviews });

    if (callback) {
      callback(idToRating);
    }
  });
    
}

module.exports = app;
