module.exports = {
  '(src|test)/**/*.js': (filenames) => [`eslint --fix ${filenames.join(' ')}`, 'node -r esm test'],
  '(README).md': ["doctoc --title '**Table of Contents**'"],
}
