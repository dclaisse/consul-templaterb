class ConsulService {
  constructor(ressourceURL, refresh) {
    this.ressourceURL = ressourceURL;
    this.fetchRessource();
    this.serviceList = $("#service-list");
    this.serviceFilter = $("#service-filter");
    this.serviceFilter.keyup(this.filterService);
    this.instanceFilter = $("#instance-filter");
    this.instanceFilter.keyup(this.filterInstances);
    this.refresh = parseInt(refresh);
    this.filterStatus = null;
    this.serviceFilterCounter = $("#service-counter");
    this.serviceFilterCount = 0;
    this.showTags($('#showTagsInList').checked)
  }

  showTags(showTags) {
    var stylesheet = document.getElementById('css-states');
    stylesheet.textContent = '.service-tags { display: ' + (showTags? 'block':'none') + ';}';
  }

  fetchRessource() {
    $.ajax({url: "consul_template.json", cache: false, dataType: "json", sourceObject: this, success: function(result){
      consulService.initRessource(result);
    }});
  }

  initRessource(data) {
    this.data = data;
    this.reloadServiceList();
    console.log('Data generated at: ' + data['generated_at']);

    var urlParam = new URL(location.href).searchParams.get('service');
    if (urlParam) {
      var nodes = document.getElementById('service-list').childNodes;
      for(var i in nodes) {
        if($(nodes[i]).find(".service-name").html() == urlParam) {
          var selectedElement = $(nodes[i])
          this.selectService(selectedElement);
          selectedElement.focus()
          break;
        }
      }
    } else {
      this.selectService(document.getElementById('service-list').firstElementChild);
    }

    if(this.refresh > 0) {
      setTimeout(this.fetchRessource, this.refresh * 1000);
    }
  }

  reloadServiceList() {
    this.serviceList.html('');
    this.serviceFilterCount = 0;
    for (var serviceName in this.data.services) {
      var service = this.data.services[serviceName];
      var serviceStatus = buildServiceStatus(service);

      var listItem = document.createElement('button');
      listItem.setAttribute('type','button');
      listItem.setAttribute('onfocus','consulService.onClickServiceName(this)');
      listItem.setAttribute('onclick','consulService.onClickServiceName(this)');
      listItem.setAttribute('value',serviceName);
      listItem.setAttribute('class','list-group-item list-group-item-action');

      var statuses = document.createElement('div');
      statuses.setAttribute('class','statuses float-right');

      if (!!serviceStatus['passing']) {
        statuses.appendChild(createBadge('badge-success passing', serviceStatus['passing']));
      }

      if (!!serviceStatus['warning']) {
        statuses.appendChild(createBadge('badge-warning warning', serviceStatus['warning']));
      }

      if (!!serviceStatus['critical']) {
        statuses.appendChild(createBadge('badge-danger critical', serviceStatus['critical']));
      }

      statuses.appendChild(createBadge('badge-dark', (serviceStatus['total'] || 0)));
      listItem.appendChild(statuses);

      var serviceNameItem = document.createElement('div');
      serviceNameItem.setAttribute('class', 'service-name');
      serviceNameItem.appendChild(document.createTextNode(serviceName));
      listItem.appendChild(serviceNameItem);

      var serviceTagsItem = document.createElement('div');
      serviceTagsItem.setAttribute('class', 'service-tags');

      for (var i = 0; i < service.tags.length; i++) {
        serviceTagsItem.appendChild(createBadge('float-right badge-' + (i%2?'secondary':'info') , service.tags[i]));
      }

      listItem.appendChild(serviceTagsItem);
      this.serviceFilterCount += 1;
      this.serviceList.append(listItem);
    }
    this.serviceFilterCounter.html(this.serviceFilterCount);
    resizeWrapper('service-wrapper', 'service-list');
    this.filterService();
  }

  filterService() {
    var filter = new RegExp(consulService.serviceFilter.val());
    consulService.serviceFilterCount = 0;
    consulService.serviceList.children('button').each(function (){
      var ui = $(this);
      if(serviceMatcher(this, filter)) {
        ui.removeClass('d-none');
        ui.addClass('d-block');
        consulService.serviceFilterCount += 1;
        consulService.serviceFilterCounter.html(consulService.serviceFilterCount);
      } else {
        ui.removeClass('d-block');
        ui.addClass('d-none');
      }
    })
  }

  onClickServiceName(source) {
    this.selectService(source);
    this.updateURL($(source).find(".service-name").html());
  }

  onClickFilter(source) {
    var status = $(source).attr('status');
    this.filterStatus = (this.filterStatus == status) ? null : status;
    this.filterInstances();
  }

  filterInstances() {
    console.log("Filtering");
    $('.progress-status').each(function() {
      var status = $(this).attr('status');
      if (consulService.filterStatus == null) {
        $(this).removeClass('progress-deactivated');
      } else if(consulService.filterStatus == status) {
        $(this).removeClass('progress-deactivated');
      } else {
        $(this).addClass('progress-deactivated');
      }
    })
    var filter = new RegExp(consulService.instanceFilter.val());
    $('#instances-list').children('div').each(function() {
      var status = $(this).attr('status');
      if(instanceMatcher(this, filter)) {
        if (consulService.filterStatus == null) {
          $(this).removeClass('d-none');
          $(this).addClass('d-block');
        } else if (consulService.filterStatus == status) {
          $(this).removeClass('d-none');
          $(this).addClass('d-block');
        } else {
          $(this).removeClass('d-block');
          $(this).addClass('d-none');
        }
      } else {
        $(this).removeClass('d-block');
        $(this).addClass('d-none');
      }
    })
  }

  updateURL(link) {
    var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    if (link) {
      newUrl += '?service=' + link
    }
    window.history.pushState({},"",newUrl);
  }

  selectService(source) {
    if (this.selectedService) {
      $(this.selectedService).removeClass('active');
    }
    var serviceName = $(source).find(".service-name").html()
    this.selectedService = source.closest( "button" );
    $(this.selectedService).addClass('active');

    this.displayService(this.data.services[serviceName]);
  }

  displayService(service) {
    $("#service-title").html(service['name']);
    $("#instances-list").html("");

    var serviceStatus = buildServiceStatus(service);

    for (var key in service['instances']) {
      var instance = service['instances'][key];
      var serviceHtml = document.createElement('div');
      serviceHtml.setAttribute('class','list-group-item');

      serviceHtml.appendChild(serviceTitleGenerator(instance));
      serviceHtml.appendChild(tagsGenerator(instance));
      serviceHtml.appendChild(checksStatusGenerator(instance));
      var state = nodeState(instance);
      serviceHtml.setAttribute('status', state);
      $("#instances-list").append(serviceHtml);
    }

    $('#service-progress-passing').css('width', (serviceStatus['passing'] || 0) / serviceStatus['total'] * 100 + '%')
    $('#service-progress-passing').html("passing (" + (serviceStatus['passing'] || 0) + ")")
    $('#service-progress-warning').css('width', (serviceStatus['warning'] || 0) / serviceStatus['total'] * 100 + '%')
    $('#service-progress-warning').html("warning (" + (serviceStatus['warning'] || 0) +")")
    $('#service-progress-critical').css('width', (serviceStatus['critical'] || 0) / serviceStatus['total'] * 100 + '%')
    $('#service-progress-critical').html("critical (" + (serviceStatus['critical'] || 0) + ")")

    resizeWrapper('instances-wrapper', 'instances-list');
    $('#instances-list .list-group-item').resize(resizeAll);
  }
}
