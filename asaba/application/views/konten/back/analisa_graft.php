
<script src="<?php echo base_url();?>code/highcharts.js"></script>
<script src="<?php echo base_url();?>code/highcharts-more.js"></script>
<script src="<?php echo base_url();?>code/modules/series-label.js"></script>
<script src="<?php echo base_url();?>code/modules/exporting.js"></script>
<script src="<?php echo base_url();?>code/modules/export-data.js"></script>
<script src="<?php echo base_url();?>code/js/themes/grid.js"></script>

<?php

if($data_sensor== null )
{
  $namasensor='';

}else
{
   $namasensor=str_replace('_', ' ', $data_sensor->{'namaSensor'});
                                    $satuan=$data_sensor->{'satuan'};
                                    $tooltip=$data_sensor->{'tooltip'};
                                    
                                    $data = $data_sensor->{'data'};
                                    $range=$data_sensor->{'range'};
                                    $nosensor= $data_sensor->{'nosensor'};
                                    if($nosensor=='sensor8')
                                    {
                                      $typegraf='column';

                                    }
                                     elseif($nosensor=='sensor9')
                                    {
                                      $typegraf='column';

                                    }
                                    else
                                    {
                                      $typegraf='spline';
                                    }
}
       
                                   

     ?>  



<div id="content">
  <div id="content-header">
    <div id="breadcrumb"><a href="#"><i class="icon-home"></i> Home</a> <?php echo anchor('analisa',ucwords($this->uri->segment(1)),'class="current"') ?> <a href="#" class="current">Grafik </a></div>

  </div>


  <div class="container-fluid">
       
<!----------  ------>
 <div class="row-fluid">
 <div class="span3">
     <div class="widget-box">

     <div class="widget-content">
      <h3><?php echo $this->session->userdata('nmlogger'); ?> </h3>

      <hr/>
     <?php  
 echo form_open('analisa/set_sensor');?>
     
      <select name="mnsensor" class="selectpicker" onchange="this.form.submit()" data-live-search="false" >
        <option>Pilih Sensor</option>
       <?php foreach($menu_sensor as $row )
        {
            echo '<option value="'.$row->idSensor.'"><i>'.str_replace('_', ' ', $row->namaSensor).'</i></option>';
         }
      ?>
      </select>
                                   
                                
<?php echo form_close() ?>

 
<hr/> 

<?php
if ($this->session->userdata('data')=='jam')
{
  echo form_open('analisa/setjam') ;?>
<div class="control-group">
<label class="control-label">Pilih Waktu</label>
<div class="controls">
<input type="input" name="jam" id="jam" class="jam" placeholder="Tanggal" autocomplete="off" />
</div></div>
<div class="control-group">
<div class="controls">
<input type="submit" class="btn btn-success" value="Tampil"/>
</div>
</div>
<?php echo form_close();?>
<hr/>
<?php
echo form_open('analisa/sesi_data');
?>

  <div class="control-group">
    <label class="control-label">Pilih Data</label>
    <div class="controls">
   <!--  <label>
    <input type="radio" name="data"  value="jam" onclick="javascript: submit()"  checked="checked"/>
    Jam</label> -->
    <label>
    <input type="radio" name="data"  value="hari" onclick="javascript: submit()"  />
    Hari</label>
    <label>
    <input type="radio" name="data" value="bulan" onclick="javascript: submit()"   />
    Bulan</label>
    <label>
    <input type="radio" name="data" value="tahun" onclick="javascript: submit()"  />
    Tahun</label>
  <!--    <label>
    <input type="radio" name="data" value="range" onclick="javascript: submit()"  />
    Range</label>-->
    </div>
<?php
  echo form_close();
}
elseif ($this->session->userdata('data')=='hari')
{
  echo form_open('analisa/settgl') ;?>
<div class="control-group">
<label class="control-label">Pilih Tanggal</label>
<div class="controls">
<input type="input" name="tgl" id="tgl" class="tgl" placeholder="Tanggal" autocomplete="off" />
</div></div>
<div class="control-group">
<div class="controls">
<input type="submit" class="btn btn-success" value="Tampil"/>
</div>
</div>
<?php echo form_close();?>
<hr/>
<?php


echo form_open('analisa/sesi_data');
?>

  <div class="control-group">
    <label class="control-label">Pilih Data</label>
    <div class="controls">
  <!--   <label>
    <input type="radio" name="data"  value="jam" onclick="javascript: submit()"  >
    Jam</label> -->
    <label>
    <input type="radio" name="data"  value="hari" onclick="javascript: submit()"  checked="checked"/>
    Hari</label>
    <label>
    <input type="radio" name="data" value="bulan" onclick="javascript: submit()"   />
    Bulan</label>
    <label>
    <input type="radio" name="data" value="tahun" onclick="javascript: submit()"  />
    Tahun</label>
  <!--    <label>
    <input type="radio" name="data" value="range" onclick="javascript: submit()"  />
    Range</label> -->
    </div>
<?php
  echo form_close();
}
elseif ($this->session->userdata('data')=='bulan')
{
  echo form_open('analisa/setbulan') ;?>
<div class="control-group">
<label class="control-label">Pilih Bulan</label>
<div class="controls">
<input type="input" name="bulan" id="bulan" class="bulan" placeholder="Bulan" autocomplete="off"/>
</div></div>
<div class="control-group">
<div class="controls">
<input type="submit" class="btn btn-success" value="Tampil"/>
</div>
</div>
<?php echo form_close();?>
<hr/>

<?php
echo form_open('analisa/sesi_data');
?>

  <div class="control-group">
    
    <label class="control-label">Pilih Data</label>
    <div class="controls">
   <!--     <label>
        <input type="radio" name="data"  value="jam" onclick="javascript: submit()"  >
    Jam</label>-->
    <label>
    <input type="radio" name="data"  value="hari" onclick="javascript: submit()"/>
    Hari</label>
    <label>
    <input type="radio" name="data" value="bulan" onclick="javascript: submit()" checked="checked"/>
    Bulan</label>
    <label>
    <input type="radio" name="data" value="tahun" onclick="javascript: submit()"  />
    Tahun</label>
 <!--    <label>
    <input type="radio" name="data" value="range" onclick="javascript: submit()"  />
    Range</label>-->
    </div>
  

<?php
  echo form_close();

}
elseif($this->session->userdata('data')=='tahun')
{
  echo form_open('analisa/settahun') ;?>
<div class="control-group">
<label class="control-label">Pilih Tahun</label>
<div class="controls">
<input type="input" name="tahun" id="tahun" class="tahun" placeholder="Tahun" onchange="this.form.submit()" autocomplete="off"/>
</div></div>
<div class="control-group">
<div class="controls">
<input type="submit" class="btn btn-success" value="Tampil"/>
</div>
</div>
<?php echo form_close();?>
<hr/>
<?php
  echo form_open('analisa/sesi_data');
?>

  <div class="control-group">
    <label class="control-label">Pilih Data</label>
    <div class="controls">
     <!--    <label>
        <input type="radio" name="data"  value="jam" onclick="javascript: submit()"  >
    Jam</label>-->
    <label>
    <input type="radio" name="data" value="hari" onclick="javascript: submit()" />
    Hari</label>
    <label>
    <input type="radio" name="data" value="bulan" onclick="javascript: submit()" />
    Bulan</label>
    <label>
    <input type="radio" name="data" value="tahun" onclick="javascript: submit()" checked="checked" />
    Tahun</label>
   <!--   <label>
    <input type="radio" name="data" value="range" onclick="javascript: submit()"  />
    Range</label> -->
    </div>
<?php
  echo form_close();
}

elseif($this->session->userdata('data')=='range')
{
  echo form_open('analisa/setrange') ;?>
  <div class="control-group">
<label class="control-label">Pilih Tanggal</label>
</div>
<div class="control-group">
<label class="control-label">Dari</label>
<div class="controls">
<input type="input" name="dari" id="dari"  placeholder="Dari Tanggal" autocomplete="off"/>
</div></div>
<div class="control-group">
<label class="control-label">Sampai</label>
<div class="controls">
<input type="input" name="sampai" id="sampai"  placeholder="Sampai Tanggal" autocomplete="off"/>
</div></div>
<div class="control-group">
<div class="controls">
<input type="submit" class="btn btn-success" value="Tampil"/>
</div>
</div>
<?php echo form_close();?>
<hr/>
<?php
  echo form_open('analisa/sesi_data');
?>

  <div class="control-group">
    <label class="control-label">Pilih Data</label>
    <div class="controls">
  <!--  <label>    
        <input type="radio" name="data"  value="jam" onclick="javascript: submit()"  >
    Jam</label> -->
    <label>
    <input type="radio" name="data" value="hari" onclick="javascript: submit()" />
    Hari</label>
    <label>
    <input type="radio" name="data" value="bulan" onclick="javascript: submit()" />
    Bulan</label>
    <label>
    <input type="radio" name="data" value="tahun" onclick="javascript: submit()"  />
    Tahun</label>
   <!--    <label>
     <input type="radio" name="data" value="range" onclick="javascript: submit()" checked="checked" />
    Range</label> -->
    </div>
<?php
  echo form_close();
}
?>


              </div>
     
      </div>
     </div>
 </div>
      <div class="span9">
        <div class="widget-box">
          <div class="widget-title"> <span class="icon"> <i class="icon-signal"></i> </span>
            <h5><?php echo $namasensor?></h5>
          </div>
          <div class="widget-content">
            
            <div id="analisa"></div>
        </div>
      </div>
    </div>

  </div>
</div>

</div>
</div>
</div>


<script type="text/javascript">

Highcharts.chart('analisa', {
  chart: {
            zoomType: 'xy'
        },

    title: {
            text: "<?php echo $namasensor ?> pada <?php echo $this->session->userdata('pada')?>"
        },
        subtitle: {
            text: 'Pos <?php echo $this->session->userdata('nmlogger') ?> '
        },
        xAxis: [{
            type: 'datetime',
            dateTimeLabelFormats: { // don't display the dummy year
            millisecond: '%H:%M',
            second: '%H:%M',
            minute: '%H:%M',
            hour: '%H:%M',
            day: '%e. %b %y',
            week: '%e. %b %y',
            month: '%b \'%y',
            year: '%Y'
               
            },
            crosshair: true
        }],
        yAxis: [ { // Secondary yAxis
          
       tickAmount: 5,
        
            title: {
                text: "<?php echo $namasensor ?>",
                style: {
                    color: Highcharts.getOptions().colors[1]
                }
            },
            labels: {
                format: "{value} <?php echo $satuan?>",
                
                style: {
                    color: Highcharts.getOptions().colors[1]
                }
            }
           
        }],
        tooltip: {
             xDateFormat: '<?php echo $tooltip ?>',
            shared: true
        },
      /*s  legend: {
            layout: 'vertical',
            align: 'left',
            x: 10,
            verticalAlign: 'top',
            y: 30,
            floating: true,
            backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'
        },
        */
        credits: {
                enabled: false
            },
    exporting: {

        
        buttons: {
            contextButton: {
                menuItems: ['printChart','separator','downloadPNG', 'downloadJPEG','downloadXLS']
            }
        },
       showTable:true

    },

        series: [ {
            name: '<?php echo $namasensor; ?>',
            type: '<?php echo $typegraf; ?>',
            data: <?php echo str_replace('"','',json_encode($data)); ?>,
            zIndex: 1,
        marker: {
            fillColor: 'white',
            lineWidth: 2,
            lineColor: Highcharts.getOptions().colors[0]
        },
            tooltip: {
                valueSuffix: ' <?php echo $satuan; ?>',
                 valueDecimals: 2,
            }
        }, {
        name: 'Range',
        data: <?php echo str_replace('"','',json_encode($range)); ?>,
        type: 'arearange',
        lineWidth: 0,
        linkedTo: ':previous',
        color: Highcharts.getOptions().colors[0],
        fillOpacity: 0.3,
        zIndex: 0,
        marker: {
            enabled: false
        },
        tooltip: {
                valueSuffix: ' <?php echo $satuan; ?>',
                 valueDecimals: 3,
            }
    }],

    responsive: {
        rules: [{
            condition: {
                maxWidth: 500
            },
            chartOptions: {
                legend: {
                    layout: 'horizontal',
                    align: 'center',
                    verticalAlign: 'bottom'
                }
            }
        }]
    }

});
    </script>