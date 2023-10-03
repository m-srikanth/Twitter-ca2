const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
let db;
const dbPath = path.join(__dirname, "twitterClone.db");
const initiatingDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("It's Running...");
    });
  } catch (e) {
    console.log(`Error is ${e.message}`);
    process.exit(1);
  }
};
initiatingDB();

//API-1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUser = `SELECT username FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const query = `INSERT INTO user ( username, password, name, gender ) VALUES ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
      await db.run(query);
      response.status(200);
      response.send("User created successfully");
    }
  }
});
//API-2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const query = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(query);
  if (dbUser !== undefined) {
    const checkPass = await bcrypt.compare(password, dbUser.password);
    if (checkPass === true) {
      const payload = { username, userId: dbUser.user_id };
      const jwtToken = jwt.sign(payload, "abcd_efgh");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
//API-3
const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "abcd_efgh", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  }
};
app.get("/user/tweets/feed/", authentication, async (request, response) => {
  let { username } = request;
  const query = `SELECT user_id FROM user WHERE username = '${username}';`;
  const userId = await db.get(query);
  const getFollowerIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${userId.user_id};`;
  const getFollowerId = await db.all(getFollowerIdsQuery);
  const array = getFollowerId.map((i) => {
    return i.following_user_id;
  });
  const getTweetQuery = `SELECT user.username, tweet.tweet, tweet.date_time AS dateTime FROM user INNER JOIN tweet ON user.user_id = tweet.user_id WHERE user.user_id IN (${array}) ORDER BY tweet.date_time DESC LIMIT 4;`;
  const result = await db.all(getTweetQuery);
  response.send(result);
});
//API-4
app.get("/user/following/", authentication, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const getFollowerIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  const getFollowerIds = getFollowerIdsArray.map((i) => {
    return i.following_user_id;
  });
  const getFollowerResultQuery = `SELECT name FROM user WHERE user_id IN (${getFollowerIds});`;
  const result = await db.all(getFollowerResultQuery);
  response.send(result);
});
//API-5
app.get("/user/followers/", authentication, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const getFollowerIdsQuery = `SELECT follower_user_id FROM follower WHERE following_user_id = ${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  const getFollowerIds = getFollowerIdsArray.map((i) => {
    return i.follower_user_id;
  });
  const getFollowersNameQuery = `SELECT name FROM user WHERE user_id IN (${getFollowerIds});`;
  const result = await db.all(getFollowersNameQuery);
  response.send(result);
});
//API-6
const outPut6 = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};
app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
  const getFollowingIds = getFollowingIdsArray.map((i) => {
    return i.following_user_id;
  });
  const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((i) => {
    return i.tweet_id;
  });
  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `SELECT COUNT(user_id) AS likes FROM like WHERE tweet_id=${tweetId};`;
    const likes_count = await db.get(likes_count_query);
    const reply_count_query = `SELECT COUNT(user_id) AS replies FROM reply WHERE tweet_id=${tweetId};`;
    const reply_count = await db.get(reply_count_query);
    const tweet_tweetDateQuery = `SELECT tweet, date_time FROM tweet WHERE tweet_id=${tweetId};`;
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);
    response.send(outPut6(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
//API-7
const outPut7 = (i) => {
  return {
    likes: i,
  };
};
app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    const getFollowingIds = getFollowingIdsArray.map((i) => {
      return i.following_user_id;
    });
    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((i) => {
      return i.tweet_id;
    });
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUserNameQuery = `SELECT user.username AS likes FROM user INNER JOIN like ON user.user_id = like.user_id WHERE like.tweet_id = ${tweetId};`;
      const getLikedUserNamesArray = await db.all(getLikedUserNameQuery);
      const getLikedUserNames = getLikedUserNamesArray.map((i) => {
        return i.likes;
      });
      response.send(outPut7(getLikedUserNames));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
//API-8
const outPut8 = (i) => {
  return {
    replies: i,
  };
};
app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    const getFollowingIds = getFollowingIdsArray.map((i) => {
      return i.following_user_id;
    });
    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((i) => {
      return i.tweet_id;
    });
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getUsernameReplayTweetsQuery = `SELECT user.name, reply.reply FROM user INNER JOIN reply ON user.user_id = reply.user_id WHERE reply.tweet_id = ${tweetId};`;
      const getUsernameReplayTweets = await db.all(
        getUsernameReplayTweetsQuery
      );
      response.send(outPut8(getUsernameReplayTweets));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
//API-9
app.get("/user/tweets/", authentication, async (request, response) => {
  let { userId } = request;
  const query = `SELECT tweet, COUNT(DISTINCT like_id) AS likes, COUNT(DISTINCT reply_id) AS replies, date_time AS dateTime FROM tweet LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id LEFT JOIN like ON tweet.tweet_id = like.tweet_id WHERE tweet.user_id = ${userId} GROUP BY tweet.tweet_id;`;
  const tweets = await db.all(query);
  response.send(tweets);
});
/*//API-9
app.get("/user/tweets/", authentication, async (request, response) => {
  let { username } = request;
  const query = `SELECT user_id FROM user WHERE username = '${username}';`;
  const userId = await db.get(query);
  const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id = ${userId.user_id};`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const getTweetIds = getTweetIdsArray.map((i) => {
    return parseInt(i.tweet_id);
  });
  response.send(getTweetIdsArray);
});*/
//API-10
app.post("/user/tweets/", authentication, async (request, response) => {
  let { username } = request;
  const query = `SELECT user_id FROM user WHERE username = '${username}';`;
  const userId = await db.get(query);
  const { tweet } = request.body;
  const currentDate = new Date();
  const postRequestQuery = `INSERT INTO tweet (tweet, user_id, date_time) VALUES ("${tweet}", "${userId.user_id}", "${currentDate}");`;
  const result = await db.run(postRequestQuery);
  const tweet_id = result.lastID;
  response.send("Created a Tweet");
});
//API-11
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const getUserTweetsListQuery = `SELECT tweet_id FROM tweet WHERE user_id = ${getUserId.user_id};`;
  const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
  const getUserTweetsList = getUserTweetsListArray.map((i) => {
    return i.tweet_id;
  });
  if (getUserTweetsList.includes(parseInt(tweetId))) {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
module.exports = app;
