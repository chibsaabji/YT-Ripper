const fs = require('fs');
const pngToIco = require('png-to-ico').default;

pngToIco('YT-RIPPER.png')
  .then(buf => {
    fs.writeFileSync('YT-RIPPER.ico', buf);
    console.log('Successfully converted YT-RIPPER.png to YT-RIPPER.ico!');
  })
  .catch(err => {
    console.error('Failed to convert icon:', err);
    process.exit(1);
  });
