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

// CONST
const DEFAULT_PAGE_LIMIT = 10;
const DEFAULT_PAGE_OFFSET = 0;
const YEARS_BACK_AND_FORWARD_TO_SEARCH_FOR = 15;

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  const filmId = Number(req.params.id);
  let limit = req.query.limit == undefined ? undefined : Number(req.query.limit);
  let offset = req.query.offset == undefined ? undefined : Number(req.query.offset);

  if (filmId && (limit >= 0 || limit == undefined) && (offset >= 0 || offset == undefined)) {
    limit = limit || DEFAULT_PAGE_LIMIT;
    offset = offset || DEFAULT_PAGE_OFFSET;

    getFilmById(filmId)
      .then((film) => {
        if (film) {
          const genreId = Number(film.genre_id);         
          const releaseDate = new Date(film.releaseDate);
          const fromDate = getYearsShiftDateString(releaseDate, -YEARS_BACK_AND_FORWARD_TO_SEARCH_FOR);
          const toDate = getYearsShiftDateString(releaseDate, YEARS_BACK_AND_FORWARD_TO_SEARCH_FOR);

          getFilmByGenre(genreId, fromDate, toDate)
            .then((results) => {
              if (results) {
                const ids = results.map(r => r.id);

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
                      releaseDate: f.releaseDate,
                      reviews: f.reviews,
                      title: f.title,
                      genre: f['genre.name']
                    };
                  });

                  filtered.sort((a,b) => a.id - b.id);

                  filtered.splice(0, filtered.length > offset ? offset : filtered.length);
                  filtered = filtered.slice(0, filtered.length > limit ? limit : filtered.length);

                  res.json({ recommendations: filtered, meta: { limit, offset } });
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
        sendError(res, 400, 'Error retrieving data.', err);
      });
  } else {
    sendError(res, 422, 'Please provide proper film id.');
  }
}

function sendError(res, code, message, err) {
  console.error('ERROR: ', message, err);
  res.status(code).json({ message, error: NODE_ENV === 'development' ? err : undefined });
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


// >>> SQL functions ==========================================================
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
  releaseDate: {
    type: Sequelize.STRING,
    field: 'release_date'
  },
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

const Genres = sequelize.define('genres', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true
  },
  name: Sequelize.STRING,
}, {
  timestamps: false
});

Films.belongsTo(Genres, { foreignKey: 'genre_id', }); 

// === functions ==============================================================
function getFilmById(filmId) {
  return Films.findById(filmId);
}

function getFilmByGenre(genre_id, fromDate, toDate) {
  return Films.findAll({
    attributes: ['id', 'releaseDate', 'title', 'genre_id'],
    where: { 
      genre_id,
      release_date: {
        $lte: toDate,
        $gte: fromDate
      }
    },
    raw: true,
    include: [{
      model: Genres,
      where: { id : genre_id }
    }]
  });
}
// <<< SQL functions ==========================================================


// >>> 3d party service  ======================================================
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
// <<< 3d party service  ======================================================

module.exports = app;