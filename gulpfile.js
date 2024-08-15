const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const rtlcss = require('gulp-rtlcss');
const rename = require('gulp-rename');
const cssmin = require('gulp-cssmin');
const sourcemaps = require('gulp-sourcemaps');
const jsmin = require('gulp-jsmin');
const connect = require('gulp-connect');
const replace = require('gulp-replace');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const tap = require('gulp-tap');
const fs = require('fs');
const path = require('path');
const merge = require('merge-stream');
const order = require('gulp-order');
const nunjucksRender = require('gulp-nunjucks-render');
const data = require('gulp-data');
const concat = require('gulp-concat');

const ENABLE_MULTILANG = 1;

const localesDir = './src/locales/';

// critical css inject function
function injectCriticalCss() {
    return gulp.src('dist/**/*.html')
        .pipe(replace('[critical-css]', '<style>' + fs.readFileSync('dist/assets/css/critical.min.css', 'utf8') + '</style>'))
        .pipe(gulp.dest('dist'));
}

// change in html to fix ciritical css inline folder access.
function criticalCssFix() {
    // change "../fonts to "fonts
    return gulp.src('dist/**/*.html')
        .pipe(replace('../fonts', '/assets/fonts'))
        .pipe(replace('../images', '/assets/images'))
        .pipe(gulp.dest('dist'));
}

function renderNunjucks() {
    if (ENABLE_MULTILANG) {
        const langs = fs.readdirSync(localesDir)
            .filter(file => ['en.json', 'ar.json'].includes(file))
            .map(file => path.basename(file, '.json'));

        const tasks = langs.map(lang => {
            let stream = gulp.src('src/pages/**/*.+(html|nunjucks)')
                .pipe(data(function (file) {
                    try {
                        const globalData = JSON.parse(fs.readFileSync(localesDir + `${lang}.json`));
                        const specificData = fs.existsSync(localesDir + lang + '/' + path.basename(file.path, '.html') + '.json') ?
                            JSON.parse(fs.readFileSync(localesDir + lang + '/' + path.basename(file.path, '.html') + '.json')) : {};
                        return Object.assign({}, globalData, specificData);
                    } catch (error) {
                        console.log(`Could not load data for ${path.basename(file.path, '.html')} in ${lang}`);
                        return {};
                    }
                }))
                .pipe(nunjucksRender())
                .pipe(htmlmin({ collapseWhitespace: true }))
                .pipe(replace('script.js', 'script.min.js')) // Replace 'script.js' with 'script.min.js' first
                .pipe(gulp.dest(`dist/${lang}`));

            let streamsToMerge = [];
            if (lang === 'en') {
                let streamEn = stream.pipe(replace('style.css', 'style.min.css'))
                    .pipe(replace('assets/', 'assets/'))
                    .pipe(gulp.dest(`dist/${lang}`));
                streamsToMerge.push(streamEn);
            }
            if (lang === 'ar') {
                let streamAr = stream.pipe(replace('style.min.css', 'style-rtl.min.css'))
                    .pipe(replace('lang="en"', 'lang="ar"'))
                    .pipe(replace('dir="ltr"', 'dir="rtl"'))
                    .pipe(replace('assets/', 'assets/'))
                    .pipe(gulp.dest(`dist/${lang}`));
                streamsToMerge.push(streamAr);
            }

            try {
                // Assuming you have a work directory inside each language directory
                const workFiles = fs.readdirSync(`${localesDir}${lang}/work`).filter(file => file.endsWith('.json'));
                const workFilesTasks = workFiles.map(workFile => {
                    // Construct work data path
                    const workDataPath = `${localesDir}${lang}/work/${workFile}`;
                    const workData = JSON.parse(fs.readFileSync(workDataPath));

                    // Load missing keys from en.json or ar.json
                    let mergedData;
                    if (lang === 'en') {
                        const enData = JSON.parse(fs.readFileSync(`${localesDir}en.json`));
                        mergedData = { ...enData, ...workData };
                    } else if (lang === 'ar') {
                        const arData = JSON.parse(fs.readFileSync(`${localesDir}ar.json`));
                        mergedData = { ...arData, ...workData };
                    }

                    // work template for each work post
                    let returnThis = gulp.src(`src/comps/work/index.nunjucks`)
                        .pipe(data(() => mergedData))
                        .pipe(nunjucksRender())
                        .pipe(htmlmin({ collapseWhitespace: true }))
                        .pipe(replace('script.js', 'script.min.js')) // Replace 'script.js' with 'script.min.js'
                    // Additional pipes as necessary
                    if (lang === 'ar') {
                        returnThis.pipe(replace('style.min.css', 'style-rtl.min.css'))
                        .pipe(replace('lang="en"', 'lang="ar"'))
                         .pipe(replace('dir="ltr"', 'dir="rtl"'))
                    } else if (lang === 'en') {
                        returnThis.pipe(replace('style.css', 'style.min.css'))
                    }
                    returnThis.pipe(gulp.dest(`dist/${lang}/work/${path.basename(workFile, '.json')}`));
                    return returnThis;
                });

            merge(...workFilesTasks, ...streamsToMerge);
            } catch (error) {
                console.log(`No case study data found for ${lang}`);
            }

            try {
                // Assuming you have a services directory inside each language directory
                const servicesFiles = fs.readdirSync(`${localesDir}${lang}/services`).filter(file => file.endsWith('.json'));
                const servicesTasks = servicesFiles.map(serviceFile => {
                    // Construct service data path
                    const serviceDataPath = `${localesDir}${lang}/services/${serviceFile}`;
                    const serviceData = JSON.parse(fs.readFileSync(serviceDataPath));

                    // Load missing keys from en.json
                    let mergedData;
                    if (lang === 'en') {
                        const enData = JSON.parse(fs.readFileSync(`${localesDir}en.json`));
                        mergedData = { ...enData, ...serviceData };
                    } else if (lang === 'ar') {
                        const arData = JSON.parse(fs.readFileSync(`${localesDir}ar.json`));
                        mergedData = { ...arData, ...serviceData };
                    }

                    // service template for each service page
                    let returnThis = gulp.src(`src/comps/services/index.nunjucks`)
                        .pipe(data(() => mergedData))
                        .pipe(nunjucksRender())
                        .pipe(htmlmin({ collapseWhitespace: true }))
                        .pipe(replace('script.js', 'script.min.js')) // Replace 'script.js' with 'script.min.js'
                    // Additional pipes as necessary
                    if (lang === 'ar') {
                        returnThis.pipe(replace('style.min.css', 'style-rtl.min.css'))
                        .pipe(replace('lang="en"', 'lang="ar"'))
                         .pipe(replace('dir="ltr"', 'dir="rtl"'))
                    } else if (lang === 'en') {
                        returnThis.pipe(replace('style.css', 'style.min.css'))
                    }
                    returnThis.pipe(gulp.dest(`dist/${lang}/services/${path.basename(serviceFile, '.json')}`));
                    return returnThis;
                });
                
                merge(...servicesTasks, ...streamsToMerge);
            } catch (error) {
                console.log(`No services data found for ${lang}`);
            }
            // for blog page
            try {
                // Assuming you have a blog directory inside each language directory
                const blogFiles = fs.readdirSync(`${localesDir}${lang}/blog`).filter(file => file.endsWith('.json'));
                const blogFilesTasks = blogFiles.map(blogFile => {
                    // Construct blog data path
                    const blogDataPath = `${localesDir}${lang}/blog/${blogFile}`;
                    const blogData = JSON.parse(fs.readFileSync(blogDataPath));

                    // Load missing keys from en.json
                    let mergedData;
                    if (lang === 'en') {
                        const enData = JSON.parse(fs.readFileSync(`${localesDir}en.json`));
                        mergedData = { ...enData, ...blogData };
                    } else if (lang === 'ar') {
                        const arData = JSON.parse(fs.readFileSync(`${localesDir}ar.json`));
                        mergedData = { ...arData, ...blogData };
                    }
                    

                    // work template for each work post
                    let returnThis = gulp.src(`src/comps/blog/index.nunjucks`)
                        .pipe(data(() => mergedData))
                        .pipe(nunjucksRender())
                        .pipe(htmlmin({ collapseWhitespace: true }))
                        .pipe(replace('script.js', 'script.min.js')) // Replace 'script.js' with 'script.min.js'
                    // Additional pipes as necessary
                    if (lang === 'ar') {
                        returnThis.pipe(replace('style.min.css', 'style-rtl.min.css'))
                        .pipe(replace('lang="en"', 'lang="ar"'))
                         .pipe(replace('dir="ltr"', 'dir="rtl"'))
                    } else if (lang === 'en') {
                        returnThis.pipe(replace('style.css', 'style.min.css'))
                    }
                    returnThis.pipe(gulp.dest(`dist/${lang}/blog/${path.basename(blogFile, '.json')}`));
                    return returnThis;
                });

            merge(...blogFilesTasks, ...streamsToMerge);
            } catch (error) {
                console.log(`No blog data found for ${lang}`);
            }
            // for careers page
            try {
                // Assuming you have a blog directory inside each language directory
                const careerFiles = fs.readdirSync(`${localesDir}${lang}/careers`).filter(file => file.endsWith('.json'));
                const careerFilesTasks = careerFiles.map(careerFile => {
                    // Construct blog data path
                    const careerDataPath = `${localesDir}${lang}/careers/${careerFile}`;
                    const careerData = JSON.parse(fs.readFileSync(careerDataPath));

                    // Load missing keys from en.json
                    let mergedData;
                    if (lang === 'en') {
                        const enData = JSON.parse(fs.readFileSync(`${localesDir}en.json`));
                        mergedData = { ...enData, ...careerData };
                    } else if (lang === 'ar') {
                        const arData = JSON.parse(fs.readFileSync(`${localesDir}ar.json`));
                        mergedData = { ...arData, ...careerData };
                    }

                    // work template for each work post
                    let returnThis = gulp.src(`src/comps/careers/index.nunjucks`)
                        .pipe(data(() => mergedData))
                        .pipe(nunjucksRender())
                        .pipe(htmlmin({ collapseWhitespace: true }))
                        .pipe(replace('script.js', 'script.min.js')) // Replace 'script.js' with 'script.min.js'
                    // Additional pipes as necessary
                    if (lang === 'ar') {
                        returnThis.pipe(replace('style.min.css', 'style-rtl.min.css'))
                        .pipe(replace('lang="en"', 'lang="ar"'))
                         .pipe(replace('dir="ltr"', 'dir="rtl"'))
                    } else if (lang === 'en') {
                        returnThis.pipe(replace('style.css', 'style.min.css'))
                    }
                    returnThis.pipe(gulp.dest(`dist/${lang}/careers/${path.basename(careerFile, '.json')}`));
                    return returnThis;
                });

            merge(...careerFilesTasks, ...streamsToMerge);
            } catch (error) {
                console.log(`No careers data found for ${lang}`);
            }
            // for impact pages
            try {
                // Assuming you have a impact directory inside each language directory
                const impactFiles = fs.readdirSync(`${localesDir}${lang}/impact`).filter(file => file.endsWith('.json'));
                const impactFilesTasks = impactFiles.map(impactFile => {
                    // Construct impact data path
                    const impactDataPath = `${localesDir}${lang}/impact/${impactFile}`;
                    const impactData = JSON.parse(fs.readFileSync(impactDataPath));

                    // Load missing keys from en.json
                    let mergedData;
                    if (lang === 'en') {
                        const enData = JSON.parse(fs.readFileSync(`${localesDir}en.json`));
                        mergedData = { ...enData, ...impactData };
                    } else if (lang === 'ar') {
                        const arData = JSON.parse(fs.readFileSync(`${localesDir}ar.json`));
                        mergedData = { ...arData, ...impactData };
                    }

                    // work template for each work post
                    let returnThis = gulp.src(`src/comps/impact/index.nunjucks`)
                        .pipe(data(() => mergedData))
                        .pipe(nunjucksRender())
                        .pipe(htmlmin({ collapseWhitespace: true }))
                        .pipe(replace('script.js', 'script.min.js')) // Replace 'script.js' with 'script.min.js'
                    // Additional pipes as necessary
                    if (lang === 'ar') {
                        returnThis.pipe(replace('style.min.css', 'style-rtl.min.css'))
                        .pipe(replace('lang="en"', 'lang="ar"'))
                        .pipe(replace('dir="ltr"', 'dir="rtl"'))
                    } else if (lang === 'en') {
                        returnThis.pipe(replace('style.css', 'style.min.css'))
                    }
                    returnThis.pipe(gulp.dest(`dist/${lang}/impact/${path.basename(impactFile, '.json')}`));
                    return returnThis;
                });

            merge(...impactFilesTasks, ...streamsToMerge);
            } catch (error) {
                console.log(`No blog data found for ${lang}`);
            }
            
            return merge(...streamsToMerge);
        });

        return merge(...tasks);
    } else {
        // Single language, assuming English
        let tasks = gulp.src('src/*.+(html|nunjucks)')
            .pipe(data(function (file) {
                try {
                    const globalData = JSON.parse(fs.readFileSync(`${localesDir}en.json`));
                    const specificDataPath = `${localesDir}${path.basename(file.path, '.html')}.json`;
                    const specificData = fs.existsSync(specificDataPath) ? JSON.parse(fs.readFileSync(specificDataPath)) : {};
                    return Object.assign({}, globalData, specificData);
                } catch (error) {
                    console.log(`Could not load data for ${path.basename(file.path, '.html')}`);
                    return {};
                }
            }))
            .pipe(nunjucksRender())
            .pipe(htmlmin({ collapseWhitespace: true }))
            .pipe(replace('script.js', 'script.min.js'))
            .pipe(gulp.dest(`dist`));

        try {
            // Handling work posts for a single language
            const workFiles = fs.readdirSync(`${localesDir}en/work`).filter(file => file.endsWith('.json'));
            const workTasks = workFiles.map(workFile => {
                const workDataPath = `${localesDir}en/work/${workFile}`;
                const workData = JSON.parse(fs.readFileSync(workDataPath));
                // Determine the directory name for the work post
                const workDirName = path.basename(workFile, '.json');
                return gulp.src(`src/comps/work/index.nunjucks`)
                    .pipe(data(() => workData))
                    .pipe(nunjucksRender())
                    .pipe(htmlmin({ collapseWhitespace: true }))
                    // Change destination to use workDirName and place index.html inside it
                    .pipe(gulp.dest(`dist/work/${workDirName}`));
            });

            // If there are work tasks, merge them with the main task
            if (workTasks.length > 0) {
                tasks = merge(tasks, ...workTasks);
            }

        } catch (error) {
            console.log("Error handling work posts:", error);
        }

        return tasks;
    }
}

function clean() {
    return del(['dist']);
}

function redirectionFile() {
    if (ENABLE_MULTILANG) {
        return new Promise(function (resolve, reject) {
            var fs = require('fs');
            var fileContent = '<html><head><meta http-equiv="refresh" content="0; url=./en" /></head></html>';

            fs.writeFile('./dist/index.html', fileContent, function (err) {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    } else {
        // no action
        return Promise.resolve();
    }
}

// function to copy all folders from src/assets to dist/assets
function copyAssets() {
    return gulp.src('src/assets/**/*')
        .pipe(gulp.dest('dist/assets'));
}

function compileSass() {
    return gulp.src('src/assets/scss/style.scss')
        .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist/assets/css'))
        .pipe(rtlcss())
        .pipe(rename({ basename: 'style-rtl' }))
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist/assets/css'))
}

function compileCritical() {
    return gulp.src('src/assets/scss/critical.scss')
        // .pipe(sourcemaps.init())
        .pipe(sass().on('error', sass.logError))
        // .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist/assets/css'))
        .pipe(rtlcss())
        .pipe(rename({ basename: 'critical-rtl' }))
        // .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist/assets/css'))
}

function minifyCss() {
    return gulp.src(['dist/assets/css/*.css', '!dist/assets/css/*min.css']) // Minify new CSS files in the assets folder
        .pipe(cssmin())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/assets/css'));
}

function minifyJsQuick() {
    return gulp.src(['src/assets/js/*.js'])
        .pipe(concat('script.js'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/assets/js'));
}

function minifyJs() {
    return gulp.src(['src/assets/js/*.js'])
        .pipe(concat('script.js'))
        .pipe(jsmin())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/assets/js'));
}

function minifyPostJs() {
    return gulp.src(['src/assets/post-js/*.js'])
        .pipe(concat('post-script.js'))
        .pipe(jsmin())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/assets/js'));
}

function minifyPostJsQuick() {
    return gulp.src(['src/assets/post-js/*.js'])
        .pipe(concat('post-script.js'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/assets/js'));
}

function minifyCriticalJs() {
    return gulp.src(['src/assets/critical-js/*.js'])
        .pipe(concat('critical-script.js'))
        .pipe(jsmin())
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/assets/js'));
}

function minifyCriticalJsQuick() {
    return gulp.src(['src/assets/critical-js/*.js'])
        .pipe(concat('critical-script.js'))
        .pipe(rename({ suffix: '.min' }))
        .pipe(gulp.dest('dist/assets/js'));
}

function reload(done) {
    connect.reload();  // Call connect.reload() to refresh browser after file updates.
    done();
}

function watchFiles() {
    gulp.watch('src/assets/scss/**/*.scss', gulp.series('compileSass', 'minifyCss', reload))
    gulp.watch('src/assets/scss/**/*.scss', gulp.series('compileCritical', 'minifyCss', reload))
    gulp.watch('src/assets/post-js/**/*.js', gulp.series('minifyPostJsQuick', reload))
    gulp.watch('src/assets/js/**/*.js', gulp.series('minifyJsQuick', reload))
    gulp.watch('src/assets/critical-js/**/*.js', gulp.series('minifyCriticalJsQuick', reload))
    gulp.watch('src/**/*.html', gulp.series('nunjucks', 'injectCriticalCss', reload))
    gulp.watch('src/locales/**/*.json', gulp.series('nunjucks', reload))
    // nunjucks file update
    gulp.watch('src/**/*.nunjucks', gulp.series('nunjucks', 'injectCriticalCss', reload))
}

// function to start a localhost server using the dist folder
function serve(done) {
    connect.server({
        root: 'dist',
        livereload: true,
        port: 8000
    });
    done();
}

function backendStuff() {
    // copy .php files from src and add to dist in relevant file structure
    return gulp.src('src/**/*.php')
        .pipe(gulp.dest('dist/en'));
}

//copy vendor folder into dist en folder
function copyVendor() {
    return gulp.src('src/vendor/**/*')
        .pipe(gulp.dest('dist/en/vendor'));
}

// a task that copies all the files from dist folder to prod folder and then changes /../assets/ assets to ../assets/ in all the html files
gulp.task('prod', function () {
    return gulp.src('dist/**/*')
        .pipe(replace('/assets/', './assets/'))
        .pipe(replace('/../assets/', '../assets/'))
        .pipe(replace('"/en"', '"../en"'))
        .pipe(replace('"/ar"', '"../ar"'))
        .pipe(replace('url=/en"', 'url="./en"'))
        .pipe(gulp.dest('prod'));
});


gulp.task('criticalCssFix', criticalCssFix);
gulp.task('injectCriticalCss', injectCriticalCss);
gulp.task('copyVendor', copyVendor);
gulp.task('backendStuff', backendStuff);
gulp.task('redirectionFile', redirectionFile);
gulp.task('copyAssets', copyAssets);
gulp.task('compileSass', compileSass);
gulp.task('compileCritical', compileCritical);
gulp.task('minifyCss', gulp.series(gulp.parallel('compileSass', 'compileCritical'), minifyCss));
gulp.task('minifyJs', minifyJs);
gulp.task('minifyPostJs', minifyPostJs);
gulp.task('minifyPostJsQuick', minifyPostJsQuick);
gulp.task('minifyJsQuick', minifyJsQuick);
gulp.task('minifyCriticalJs', minifyCriticalJs);
gulp.task('minifyCriticalJsQuick', minifyCriticalJsQuick);
gulp.task('watch', watchFiles);
gulp.task('serve', serve);
gulp.task('reload', reload);
gulp.task('nunjucks', renderNunjucks);

gulp.task('default', gulp.series(clean, 'compileSass', 'compileCritical', 'minifyCss', 'copyAssets', 'minifyJsQuick', 'minifyPostJsQuick', 'minifyCriticalJsQuick', 'nunjucks', 'redirectionFile', 'copyVendor', 'backendStuff', 'injectCriticalCss', 'criticalCssFix', 'serve', 'watch'));
gulp.task('prod', gulp.series(clean, 'compileSass', 'compileCritical', 'minifyCss', 'copyAssets', 'minifyJs', 'minifyPostJs', 'minifyCriticalJs', 'nunjucks', 'copyVendor', 'backendStuff', 'redirectionFile', 'injectCriticalCss', 'criticalCssFix', 'prod'));