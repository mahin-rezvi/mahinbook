export type Person = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  online?: boolean;
};

export type Comment = {
  id: string;
  author: Person;
  text: string;
  time: string;
};

export type ReactionType = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";

export type Post = {
  id: string;
  author: Person;
  time: string;
  content: string;
  image?: string;
  imageAlt?: string;
  likes: number;
  comments: Comment[];
  liked: boolean;
  reaction?: ReactionType;
  location?: string;
};

export const currentPerson: Person = {
  id: "you",
  name: "Alex Morgan",
  handle: "alexmorgan",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&h=160&q=85",
};

export const people: Person[] = [
  { id: "1", name: "Sofia Chen", handle: "sofiachen", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&h=160&q=85", online: true },
  { id: "2", name: "Noah Williams", handle: "noahw", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&h=160&q=85", online: true },
  { id: "3", name: "Amara Okafor", handle: "amarao", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&h=160&q=85" },
  { id: "4", name: "Leo Martinez", handle: "leomartinez", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&h=160&q=85" },
  { id: "5", name: "Mina Park", handle: "minapark", avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&h=160&q=85", online: true },
];

export const initialPosts: Post[] = [
  {
    id: "post-1",
    author: people[0],
    time: "18 min ago",
    location: "Golden Gate Park",
    content: "Took the long way home and found this little pocket of quiet. Reminder to leave a little room in your day for getting lost 🌿",
    image: "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Sunlight filtering through a green forest",
    likes: 128,
    liked: false,
    comments: [
      { id: "c-1", author: people[1], text: "This is your sign to take me here next time!", time: "12 min" },
      { id: "c-2", author: people[2], text: "Exactly the kind of afternoon I need.", time: "8 min" },
    ],
  },
  {
    id: "post-2",
    author: people[1],
    time: "1 hr ago",
    content: "Made enough sourdough for the whole block this morning. If you’re nearby, there’s a loaf with your name on it 🥖",
    image: "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Freshly baked bread on a wooden table",
    likes: 86,
    liked: true,
    comments: [{ id: "c-3", author: people[4], text: "On my way 🏃‍♀️", time: "34 min" }],
  },
  {
    id: "post-3",
    author: people[2],
    time: "3 hrs ago",
    content: "A tiny reminder that you don’t have to have it all figured out to take the next step. Proud of you for showing up today 💛",
    likes: 204,
    liked: false,
    comments: [],
  },
];
