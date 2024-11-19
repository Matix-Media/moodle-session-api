# moodle-session-api

Interact with Moodle, while letting moodle think you're a human.

## Usage

### Starting a session

```ts
import MoodleSession from "moodle-session-api";

const session = new MoodleSession({
    baseUrl: "https://moodle.example.com",
});

await session.login("username", "password");
```

### Interacting with Moodle

In order to make use of your created session, you can simply call `get`, `post`, `put` and `delete` on it.

```ts
const res = await session.get("/mod/forum/view.php?id=1");
console.log(res.data);

await session.post("/mod/forum/post.php", {
    message: "Hello world!",
});
```

You can also use the `client` property to get the underlying axios instance to perform more advanced requests.

```ts
session.client.get("/mod/forum/view.php?id=1");
```