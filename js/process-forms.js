
'use strict';

let ProcessForm = function (settings) {
    
    this.settings = {
        selector: '#feedback-form', // дефолтный селектор
        attachmentsMaxFileSize: 512, // дефолтный максимальный размер файла в Кб
        attachmentsFileExt: ['jpg', 'jpeg', 'pdf', 'doc', 'png'], // дефолтные допустимые расширения для файлов
        isUseDefaultSuccessMessage: true // отображать дефолтное сообщение об успешной отправки формы
    };
    
   
    this.isAttachmentsSection = true; // имеется ли в форме блок для добавления к ней файлов
    this.attachmentsIdCounter = 0; // счетчик, хранящий количество добавленных к форме файлов
    this.attachmentsMaxItems = 5; // переменная, определяющее максимальное количество файлов, которые можно прикрепить к форме
    this.attachmentsItems = []; // переменная, хранящая массив файлов, которые нужно прекрепить к форме

    for (let propName in settings) {
        if (settings.hasOwnProperty(propName)) {
            this.settings[propName] = settings[propName];
        }
    }
    this._form = $(this.settings.selector).eq(0);
};

ProcessForm.prototype = function () {

    // изменение состояния элемента формы (success, error, clear)
    const setStateValidaion = (input, state, message) => {
        input = $(input);
        if (state === 'error') {
            input
                .removeClass('is-valid').addClass('is-invalid')
                .siblings('.invalid-feedback').text(message);
        } else if (state === 'success') {
            input.removeClass('is-invalid').addClass('is-valid');
        } else {
            input.removeClass('is-valid is-invalid');
        }
    };

    // метод, возвращающий результат проверки расширения файла допустимому
    const validateFileExtension = (filename, validFileExtensions) => {
        // получаем расширение файла
        let fileExtension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
        // если есть расширение, то проверяем соотвествует ли оно допустимому
        if (fileExtension) {
            for (let i = 0; i <= validFileExtensions.length; i++) {
                if (validFileExtensions[i] === fileExtension.toLowerCase()) {
                    return true;
                }
            }
        }
        return false;
    };

    // валилация формы
    const validateForm = (_this) => {
        let valid = true;
        _this._form.find('textarea').not('[type="file"], [name="agree"]').each(function () {
            if (this.checkValidity()) {
                setStateValidaion(this, 'success');
            } else {
                setStateValidaion(this, 'error', this.validationMessage);
                valid = false;
            }
        });
        if (_this.attachmentsItems.length > 0) {
            let files = _this.attachmentsItems;
            for (let i = 0, length = files.length; i < length; i++) {
                // проверим размер и расширение файла
                if (files[i].file.size > _this.settings.attachmentsMaxFileSize * 1024) {
                    _this._form.find('.form-attachments__item[data-id="' + i + '"]').attr('title', 'Размер файла больше ' + _this.settings.attachmentsMaxFileSize + 'Кб').addClass('is-invalid');
                    valid = false;
                } else if (!validateFileExtension(files[i].file.name, _this.settings.attachmentsFileExt)) {
                    _this._form.find('.form-attachments__item[data-id="' + i + '"]').attr('title', 'Тип не соответствует разрешённым').addClass('is-invalid');
                    valid = false;
                } else {
                    _this._form.find('.form-attachments__item[data-id="' + i + '"]').attr('title', '').addClass('is-valid');
                }
            }
        }
        return valid;
    };

    const showForm = (_this) => {
        if (!_this._form.find('.form-error').hasClass('d-none')) {
            _this._form.find('.form-error').addClass('d-none');
        }
        _this._form.siblings('.form-result-success').addClass('d-none').removeClass('d-flex');
        _this._form[0].reset();
        _this._form.find('textarea, input').each(function () {
            setStateValidaion(this, 'clear');
        });
        if (_this.isAttachmentsSection) {
            _this._form.find('.form-attachments__item').remove();
        }
    };

    const changeStateImages = (_this, state) => {
        if (!_this.isAttachmentsSection) {
            return;
        }
        _this._form.find('[name="attachment[]"]').prop('disabled', state);
    };

    // собираем данные для отправки на сервер
    const collectData = (_this) => {
        let output;
        changeStateImages(_this, true);
        output = new FormData(_this._form[0]);
        changeStateImages(_this, false);
        for (let i = 0, length = _this.attachmentsItems.length; i < length; i++) {
            output.append('attachment[]', _this.attachmentsItems[i].file);
        }
        return output;
    };

    // отправка формы
    const sendForm = (_this) => {
        $(document).trigger('beforeSubmit', [_this._form]);
        if (!validateForm(_this)) {
            if (_this._form.find('.is-invalid').length > 0) {
                if (_this._form.find('.is-invalid').hasClass('file')) {
                    _this._form.find('input[type="file"]').focus();
                } else {
                    _this._form.find('.is-invalid')[0].focus();
                }
            }
            return;
        }

        if (!_this._form.find('.form-error').hasClass('d-none')) {
            _this._form.find('.form-error').addClass('d-none');
        }

        $.ajax({
            context: _this,
            type: "POST",
            url: _this._form.attr('action'),
            data: collectData(_this), // данные для отправки на сервер
            contentType: false,
            processData: false,
            cache: false,
            xhr: function () {
                let myXhr = $.ajaxSettings.xhr();
                if (_this._form.find('.progress').hasClass('d-none')) {
                    _this._form.find('.progress').removeClass('d-none');
                }
                if (myXhr.upload) {
                    myXhr.upload.addEventListener('progress', function (event) {
                        // если известно количество байт для пересылки
                        if (event.lengthComputable) {
                            // получаем общее количество байт для пересылки
                            let total = event.total;
                            // получаем какое количество байт уже отправлено
                            let loaded = event.loaded;
                            // определяем процент отправленных данных на сервер
                            let progress = ((loaded * 100) / total).toFixed(1);
                            // обновляем состояние прогресс бара Bootstrap
                            let progressBar = _this._form.find('.progress-bar');
                            progressBar.attr('aria-valuenow', progress);
                            progressBar.width(progress + '%');
                            progressBar.find('.sr-only').text(progress + '%');
                        }
                    }, false);
                }
                return myXhr;
            }
        })
        .done(success)
        .fail(error)
    };

    // при получении успешного ответа от сервера
    const success = function (data) {
        let _this = this;
        if (_this._form.find('.progress').length) {
            _this._form
                .find('.progress').addClass('d-none')
                .find('.progress-bar').attr('aria-valuenow', '0').width('0')
                .find('.sr-only').text('0%');
        }
        // при успешной отправки формы
        if (data.result === "success") {
            $(document).trigger('pf_success', {data: this});
            if (_this.settings.isUseDefaultSuccessMessage) {
                _this._form.parent().find('.form-result-success')
                    .removeClass('d-none')
                    .addClass('d-flex');
                setTimeout(() => {
                    showForm(this);
                }, 1000); 
            }
           
            return;
        }
        // если произошли ошибки при отправке
        _this._form.find('.form-error').removeClass('d-none');
        changeStateSubmit(this, false);

        _this._form.find('.form-attachments__item').attr('title', '').removeClass('is-valid is-invalid');

        // выводим ошибки которые прислал сервер
        for (let error in data) {
            if (!data.hasOwnProperty(error)) {
                continue;
            }
            switch (error) {
                case 'captcha':
                    _refreshCaptcha(_this);
                    setStateValidaion(_this._form.find('[name="' + error + '"]'), 'error', data[error]);
                    break;
                case 'attachment':
                    $.each(data[error], function (key, value) {
                        _this._form.find('.form-attachments__item[data-id="' + _this.attachmentsItems[key].id + '"]').attr('title', value).addClass('is-invalid');
                    });
                    break;
                case 'log':
                    $.each(data[error], function (key, value) {
                        console.log(value);
                    });
                    break;
                default:
                    setStateValidaion(_this._form.find('[name="' + error + '"]'), 'error', data[error]);
            }
        }
        // устанавливаем фокус на 1 невалидный элемент
        if (_this._form.find('.is-invalid').length > 0) {
            if (_this._form.find('.is-invalid').hasClass('file')) {
                _this._form.find('input[type="file"]').focus();
            } else {
                _this._form.find('.is-invalid')[0].focus();
            }
        }
        _this._form.find('.form-attachments__item').not('.is-invalid').addClass('is-valid');
    };

    // если не получили успешный ответ от сервера
    let error = function () {
        this._form.find('.form-error').removeClass('d-none');
    };

    // функция для инициализации
    let init = function () {
        
        
        // устанавливаем значения свойств isAttachmentsSection и attachmentsMaxItems в завимости от того имеется ли у формы секция с секцией для добавления к ней файлов
        let formAttachments = this._form.find('.form-attachments');
        if (formAttachments.length) {
            this.isAttachmentsSection = true;
            if (formAttachments.attr('data-count')) {
                this.attachmentsMaxItems = +formAttachments.attr('data-count');
            }
        }
        setupListener(this);
    };

    let reset = function () {
        showForm(this);
    };

    // устанавливаем обработчики событий
    let setupListener = function (_this) {
        $(document).on('change', _this.settings.selector + ' [name="agree"]', function () {
            changeStateSubmit(_this, !this.checked);
        });
        $(document).on('submit', _this.settings.selector, function (e) {
            e.preventDefault();
            sendForm(_this);
        });
        
        
        // события для удаления добавленного к форме файла
        $(document).on('click', _this.settings.selector + ' .form-attachments__item-link', function () {
            let
                link = $(this),
                fileId = +link.attr('data-id'),
                file = link.closest('.form-attachments__item');
            for (let i = 0, length = _this.attachmentsItems.length; i < length; i++) {
                if (_this.attachmentsItems[i].id === fileId) {
                    _this.attachmentsItems.splice(i, 1);
                    break;
                }
            }
            file.remove();
        });
        // событие при изменении элемента input с type="file" (name="attachment[])
        $(document).on('change', _this.settings.selector + ' input[name="attachment[]"]', function (e) {
            let file, fileId, removeLink;

            for (let i = 0, length = e.target.files.length; i < length; i++) {
                if (_this.attachmentsItems.length === _this.attachmentsMaxItems) {
                    e.target.value = '';
                    break;
                }
                fileId = _this.attachmentsIdCounter++;
                file = e.target.files[i];
                _this.attachmentsItems.push({
                    id: fileId,
                    file: file
                });
                if (file.type.match(/image.*/)) {
                    let reader = new FileReader();
                    reader.readAsDataURL(file);
                    (function (file, fileId) {
                        reader.addEventListener('load', function (e) {
                            let removeLink = '<div class="form-attachments__item" data-id="' + fileId + '">' +
                                '<div class="form-attachments__item-wrapper">' +
                                '<img class="form-attachments__item-image" src="' + e.target.result + '" alt="' + file.name + '">' +
                                '<div class="form-attachments__item-name">' + file.name + '</div>' +
                                '<div class="form-attachments__item-size">' + (file.size / 1024).toFixed(1) + 'Кб' + '</div>' +
                                '<div class="form-attachments__item-link" data-id="' + fileId + '">×</div>' +
                                '</div>' +
                                '</div>';
                            _this._form.find('.form-attachments__items').append(removeLink);
                        });
                    })(file, fileId);
                    continue;
                }
                removeLink = '<div class="form-attachments__item" data-id="' + fileId + '">' +
                    '<div class="form-attachments__item-wrapper">' +
                    '<div class="form-attachments__item-name">' + file.name + '</div>' +
                    '<div class="form-attachments__item-size">' + (file.size / 1024).toFixed(1) + 'Кб' + '</div>' +
                    '<div class="form-attachments__item-link" data-id="' + fileId + '">×</div>' +
                    '</div>' +
                    '</div>';
                _this._form.find('.form-attachments__items').append(removeLink);
            }
            e.target.value = null;
        });
        
    };
    return {
        init: init,
        reset: reset
    }
}();

$(function () {
    let formFeedback = new ProcessForm({

    });
    formFeedback.init();

    $("#file").fileinput({
        theme: 'fas',
        language: 'ru',
        showUpload: false,
        showCaption: false,
        showBrowse: true,
        showClose: false,
        showCancel: false,
        browseOnZoneClick: true,
        fileType: "any",
        previewFileIcon: "<i class='glyphicon glyphicon-king'></i>",
        overwriteInitial: false,
        initialPreviewAsData: true,
    });
});

