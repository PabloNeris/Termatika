const CHARACTERS = [
  'Capitão', 'Fera', 'Craque', 'Estrela', 'Foguete',
  'Relâmpago', 'Campeão', 'Fenômeno', 'Ás', 'Herói',
];

const ANIMALS = [
  'Tigre', 'Coruja', 'Raposa', 'Falcão', 'Leão',
  'Jaguar', 'Águia', 'Pantera', 'Lobo', 'Gavião',
];

const TEAMS = [
  'Brasil', 'Argentina', 'Alemanha', 'França', 'Espanha',
  'Portugal', 'Japão', 'Marrocos', 'Croácia', 'Coreia do Sul',
];

function generateNickname() {
  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return { character, animal, full: `${character} ${animal}` };
}
