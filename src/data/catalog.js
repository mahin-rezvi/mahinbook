const books = [
  ['The Midnight Library','Matt Haig','A dazzling novel about all the choices that go into a life well lived.','9780525559474','Fiction'],
  ['Atomic Habits','James Clear','A practical guide to building good habits and breaking bad ones.','9780735211292','Self-help'],
  ['Dune','Frank Herbert','A landmark science fiction epic set on the desert planet Arrakis.','9780441013593','Science Fiction'],
  ['The Alchemist','Paulo Coelho','A shepherd boy follows a dream in search of treasure and meaning.','9780062315007','Fiction'],
  ['Educated','Tara Westover','A memoir about a young woman who leaves her survivalist family for education.','9780399590504','Memoir'],
  ['Pride and Prejudice','Jane Austen','A witty story of manners, family, and unexpected love.','9780141439518','Classic'],
  ['The Hobbit','J.R.R. Tolkien','Bilbo Baggins is swept into an unforgettable adventure.','9780547928227','Fantasy'],
  ['Sapiens','Yuval Noah Harari','A brief history of humankind, from ancient ancestors to modern societies.','9780062316097','History'],
  ['Tomorrow, and Tomorrow, and Tomorrow','Gabrielle Zevin','A friendship shaped by creativity, collaboration, and the games we play.','9780593321201','Fiction'],
  ['The Song of Achilles','Madeline Miller','A retelling of the myth of Achilles and Patroclus.','9780062060624','Fantasy'],
  ['Project Hail Mary','Andy Weir','An astronaut wakes up alone with one impossible mission.','9780593135204','Science Fiction'],
  ['Crying in H Mart','Michelle Zauner','A moving memoir about family, food, grief, and identity.','9780525657743','Memoir'],
  ['The Little Prince','Antoine de Saint-Exupéry','A poetic tale about friendship, love, and seeing with the heart.','9780156012195','Classic'],
  ['Ikigai','Héctor García and Francesc Miralles','A gentle exploration of purpose and the secrets of a long life.','9780143130727','Self-help'],
  ['Circe','Madeline Miller','The story of the witch from The Odyssey, told in her own voice.','9780316556347','Fantasy'],
  ['The Creative Act','Rick Rubin','A guide to the process of creating and finding inspiration.','9780593652886','Art']
].map(([title, author, description, isbn, genre]) => ({
  title, author, description, genre,
  coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  published: '', seeded: true
}));

module.exports = { starterCatalog: books };
