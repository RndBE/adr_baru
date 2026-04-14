<?php if ( ! defined('BASEPATH')) exit('No direct script access allowed');

class Data extends CI_Controller {
	function __construct() {
		parent::__construct();

		$this->load->model('m_ketinggian');
	}

	public function logger($id_logger)
	{
		$tabel = $this->db->join('t_logger','t_logger.kategori_log = kategori_logger.id_katlogger')->where('t_logger.id_logger',$id_logger)->get('kategori_logger')->row();
		$data = $this->db->where('code_logger',$id_logger)->get($tabel->temp_data)->row_array();
		$dt = [];
		$dt['id_logger'] = $tabel->id_logger;
		$dt['temp_tabel'] = $tabel->temp_data;
		$dt['tabel'] = $tabel->tabel;
		foreach($data as $k => $v){
			if($k != 'id'){
				
				$dt['data'][$k] =$v;
			}
		}
		return $dt;
	}

	function get_data(){
		$data = $this->db->join('kategori_logger','t_logger.kategori_log = kategori_logger.id_katlogger')->get('t_logger')->result_array();
		$dt = [];
		foreach($data as $k=>$v)  {
			$temp_data = $this->db->where('code_logger',$v['id_logger'])->get($v['temp_data'])->row();
			$dt[]= $this->logger($v['id_logger']);
			
	//		$this->db->insert($v['tabel'],$dt);
		}
		echo json_encode($dt);
	}
	
	public function index()
	{

		$data_terakhir=array();
		$tab=array();
		$isitab=array();
		$tooltip="Waktu %d-%m-%Y %H:%M";
		foreach ($this->m_ketinggian->sensor_home() as $row ) {
			# code...
			$data_sensor=array();
			$idlog=$row->logger_id;
			$sensor=$row->sensor;
			$sensorid=$row->sensorhome_id;
			$nama_sensor=$row->nama_sensor;
			$alias_sensor=$row->alias_sensor;
			$satuan=$row->satuan;
			//$isi=array();
			foreach ($this->m_ketinggian->data_terakhir($idlog) as $datalog) {
				# code...
				$waktu=$datalog->waktu;
				$isi=$datalog->$sensor;
			}

			foreach ($this->m_ketinggian->datasen($idlog,$sensor,$alias_sensor) as $datasensor) {
				# code...
				$data_sensor[] ="[ Date.UTC(".$datasensor->tahun.",".$datasensor->bulan."-1,".$datasensor->hari.",".$datasensor->jam."),". number_format($datasensor->$alias_sensor,3)  ."]";

			}


			$data_terakhir[] ='<div class="col-12 col-sm-6 col-lg-3">
                    		<div class="single-cool-fact-area mb-50">
                    		<div class="kotak">
                    		<h6>'. $nama_sensor .'</h6>
	                    	<h6>'. $waktu .'</h6>	
                    		<h2><span >'.$isi.' '.$satuan.'</span></h2>
                    		</div>
                    		</div>
                			</div>';  
			$tab[] = ' <li class="nav-item">
                                <a class="nav-link" id="tab--'.$idlog.'" data-toggle="tab" href="#tab'.$idlog.'_'.$sensor.'" role="tab" aria-controls="tab'.$idlog.'" aria-selected="false">'.$nama_sensor.'</a>
                            </li>';

			$isitab[]='<div class="tab-pane fade" id="tab'.$idlog.'_'.$sensor.'" role="tabpanel" aria-labelledby="tab--'.$idlog.'">
                                <div class="south-tab-content">

                                    <div class="south-tab-text">

                                         <div id="analisa'.$idlog.'_'.$sensor.'"></div>
                                    </div>
                                </div>
                            </div>


<script type="text/javascript">

Highcharts.chart("analisa'.$idlog.'_'.$sensor.'", {
  chart: {
            zoomType: "xy"
        },

    title: {
            text: "Rata-Rata '.$nama_sensor.'"
        },
        subtitle: {
           text: "pada '.$this->session->userdata("pada"). '"
        },
        xAxis: [{
            type: "datetime",
            dateTimeLabelFormats: { 
            millisecond: "%H:%M",
            second: "%H:%M",
            minute: "%H:%M",
            hour: "%H:%M",
            day: "%e. %b %y",
            week: "%e. %b %y",
            month: "%b \"%y",
            year: "%Y"

            },
            crosshair: true
        }],
        yAxis: [ { // Secondary yAxis
            title: {
                text: "'.$nama_sensor.'",
                style: {
                    color: Highcharts.getOptions().colors[1]
                }
            },
            labels: {
                format: "{value} '.$satuan.'",

                style: {
                    color: Highcharts.getOptions().colors[1]
                }
            }

        }],
        tooltip: {
             xDateFormat: "'.$tooltip.'",
           // shared: true
        },
      /*  legend: {
            layout: "vertical",
            align: "left",
            x: 10,
            verticalAlign: "top",
            y: 30,
            floating: true,
            backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || "#FFFFFF"
        },
        */
        credits: {
                enabled: false
            },
    exporting: {
        enabled: false

    },

        series: [ {
            name: "'.$nama_sensor.'",
            type: "spline",
            data: ['.join($data_sensor,',').'],
            tooltip: {
                valueSuffix: " '.$satuan.'",
                 valueDecimals: 3,
            }
        }],

    responsive: {
        rules: [{
            condition: {
                maxWidth: 300
            },
            chartOptions: {
                legend: {
                    layout: "horizontal",
                    align: "center",
                    verticalAlign: "bottom"
                }
            }
        }]
    }

});
    </script>

';               		

		}
		$data['data_terakhir']= $data_terakhir;
		$data['tab']= $tab;
		$data['isitab']= $isitab;
		//$data['query']= $this->m_ketinggian->ketinggian();
		$data['konten']='konten/hal_ketinggian';
		$this->load->view('template/site',$data);
	}


	function load_data()
	{
		$tgl=date('Y-m-d');
		$this->session->set_userdata('pada',$tgl);
		redirect('data');
	}

	function sesi_data()
	{
		$this->session->set_userdata('pada',$this->input->post('tgl'));
		redirect('data');
	}
}
